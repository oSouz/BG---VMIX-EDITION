"""Render the same specialized Studio shaders directly on the GPU for NDI."""
import json
import os
from pathlib import Path
import re
import sys
import threading
import time
import urllib.request
import uuid

sys.path.insert(0, str(Path(__file__).parent / 'python-libs'))
try:
    import moderngl as GL
except ImportError as error:
    raise RuntimeError('Prepare o NDI abrindo PREPARAR-NDI.bat uma vez.') from error

VERTEX = '''#version 330
out vec2 i_uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
i_uv=vec2(p.x,1.-p.y);gl_Position=vec4(p*2.-1.,0.,1.);}'''


class Renderer:
    def __init__(self, width, height, fps, stop):
        self.base, self.token = os.environ['SOUZ_STUDIO_URL'], os.environ['SOUZ_STUDIO_TOKEN']
        self.output_id, self.stop = str(uuid.uuid4()), stop
        self.width, self.height, self.fps = width, height, fps
        self.state, self.received, self.stream_error = None, 0, None
        self.assets = self.request('/api/assets')
        self.ctx = GL.create_standalone_context(require=330)
        self.fbo = self.ctx.simple_framebuffer((width, height), components=4)
        self.fbo.use()
        self.cache = {}
        self.acked, self.rejected = None, None
        self.pixels = bytearray(width*height*4)
        threading.Thread(target=self.events, daemon=True).start()

    def request(self, path, data=None):
        body = json.dumps(data).encode() if data is not None else None
        request = urllib.request.Request(self.base+path, data=body,
                                         headers={'X-Souz-Token': self.token, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(request, timeout=5) as response:
            return json.load(response)

    def events(self):
        try:
            request = urllib.request.Request(self.base+'/api/events?token='+self.token+'&output='+self.output_id)
            with urllib.request.urlopen(request, timeout=5) as stream:
                self.stream = stream
                while not self.stop.is_set():
                    line = stream.readline()
                    if not line:
                        raise RuntimeError('Studio desconectado')
                    if line.startswith(b'data: '):
                        self.state = json.loads(line[6:])
                        self.received = time.monotonic()
        except Exception as error:
            if not self.stop.is_set():
                self.stream_error = error

    def prepare(self, engine, keep):
        if engine in self.cache:
            return
        for key in list(self.cache):
            if key not in keep:
                vao, program = self.cache.pop(key)
                vao.release()
                program.release()
        source = self.assets['parts']['common']+self.assets['parts']['engines'][engine]
        source = source.replace('#version 300 es', '#version 330')
        source = re.sub(r'precision\s+\w+\s+\w+;', '', source)
        program = self.ctx.program(vertex_shader=VERTEX, fragment_shader=source)
        self.cache[engine] = self.ctx.vertex_array(program, []), program

    def draw(self, engine, values, clock, phase, opacity):
        vao, program = self.cache[engine]
        uniforms = {**values, 'resolution': (self.width, self.height), 'animTime': clock,
                    'phase': phase, 'previewOpacity': opacity}
        for definition in self.assets['schema']:
            if definition['kind'] == 'bool':
                uniforms[definition['name']] = int(values[definition['name']] > .5)
        for name, value in uniforms.items():
            if name in program:
                program[name].value = value
        vao.render(vertices=3)

    @staticmethod
    def speed(values):
        return values['Speed']**2*4*(-1 if values['Reverse'] > .5 else 1)

    def frames(self):
        deadline = time.monotonic()+10
        while self.state is None:
            if self.stream_error:
                raise self.stream_error
            if self.stop.is_set():
                return
            if time.monotonic() > deadline:
                raise RuntimeError('Studio não enviou estado para NDI')
            time.sleep(.01)
        next_frame = time.monotonic()
        try:
            while not self.stop.is_set():
                if self.stream_error:
                    raise self.stream_error
                state = self.state
                elapsed = min(.25, max(0, time.monotonic()-self.received))
                values, fade, scene = state['params'], state['fade'], state['scene']
                scene = scene if scene['status'] == 3 else None
                old_engine = scene['from']['Engine'] if scene else fade['from']
                engine = values['Engine']
                progress = min(1, scene['progress']+elapsed/scene['duration'] if scene else fade['progress']+elapsed/.6)
                transition = progress < 1 and (scene is not None or old_engine != engine)
                needed = {int(engine), int(old_engine)} if transition else {int(engine)}
                for key in needed:
                    self.prepare(key, needed)
                preparation = state.get('preparation')
                if preparation and preparation['id'] != self.rejected:
                    try:
                        self.prepare(int(preparation['engine']), needed | {int(preparation['engine'])})
                        if preparation['id'] != self.acked:
                            self.request('/api/output/ready', {'outputId': self.output_id, 'preparationId': preparation['id']})
                            self.acked = preparation['id']
                    except Exception:
                        self.rejected = preparation['id']
                        self.request('/api/output/error', {'outputId': self.output_id, 'preparationId': preparation['id']})
                clock = state['animTime']+elapsed*self.speed(values)
                phase = (state['phase']+elapsed*state['bpm']/240) % 1
                self.ctx.disable(GL.BLEND)
                if transition:
                    old = scene['from'] if scene else {**values, 'Engine': old_engine}
                    old_clock = scene['oldTime']+elapsed*self.speed(old) if scene else clock
                    self.draw(int(old_engine), old, old_clock, phase, 1)
                    self.ctx.enable(GL.BLEND)
                    self.ctx.blend_func = GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA, GL.ONE, GL.ONE_MINUS_SRC_ALPHA
                    self.draw(int(engine), values, clock, phase, progress*progress*(3-2*progress))
                else:
                    self.draw(int(engine), values, clock, phase, 1)
                self.fbo.read_into(self.pixels, components=4, alignment=1)
                yield self.pixels
                next_frame += 1/self.fps
                delay = next_frame-time.monotonic()
                if delay > 0:
                    self.stop.wait(delay)
                else:
                    next_frame = time.monotonic()
        finally:
            self.stop.set()
            for vao, program in self.cache.values():
                vao.release()
                program.release()
            self.fbo.release()
            self.ctx.release()
