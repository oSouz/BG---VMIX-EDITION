"""NDI runtime ABI bridge. stdin is packed, top-down RGBA; no third party Python packages."""
import argparse
import ctypes as C
import json
import os
from pathlib import Path
import sys
import time
import threading


class SendCreate(C.Structure):
    _fields_ = [('name', C.c_char_p), ('groups', C.c_char_p), ('clock_video', C.c_bool), ('clock_audio', C.c_bool)]


class VideoFrame(C.Structure):
    _fields_ = [('xres', C.c_int), ('yres', C.c_int), ('fourcc', C.c_uint32),
                ('rate_n', C.c_int), ('rate_d', C.c_int), ('aspect', C.c_float),
                ('format', C.c_int), ('timecode', C.c_int64), ('data', C.c_void_p),
                ('stride', C.c_int), ('metadata', C.c_char_p), ('timestamp', C.c_int64)]


def runtime_path():
    explicit = os.environ.get('SOUZ_NDI_RUNTIME')
    candidates = [Path(explicit)] if explicit else []
    for env in ('NDI_RUNTIME_DIR_V6', 'NDI_RUNTIME_DIR_V5'):
        if os.environ.get(env):
            candidates.append(Path(os.environ[env]) / 'Processing.NDI.Lib.x64.dll')
    root = Path(os.environ.get('ProgramFiles', r'C:\Program Files')) / 'NDI'
    if root.exists():
        candidates.extend(root.glob('**/Processing.NDI.Lib.x64.dll'))
    for path in candidates:
        if path.is_file():
            return path.resolve()
    raise RuntimeError('Runtime NDI x64 não encontrado. Instale https://ndi.link/NDIRedistV6 e reinicie o Studio.')


def load_runtime():
    if C.sizeof(C.c_void_p) != 8:
        raise RuntimeError('É necessário Python x64.')
    path = runtime_path()
    dll = C.CDLL(str(path))
    signatures = {
        'NDIlib_initialize': (C.c_bool, []),
        'NDIlib_destroy': (None, []),
        'NDIlib_send_create': (C.c_void_p, [C.POINTER(SendCreate)]),
        'NDIlib_send_destroy': (None, [C.c_void_p]),
        'NDIlib_send_send_video_v2': (None, [C.c_void_p, C.POINTER(VideoFrame)]),
        'NDIlib_send_get_no_connections': (C.c_int, [C.c_void_p, C.c_uint32]),
    }
    for name, (result, args) in signatures.items():
        fn = getattr(dll, name)
        fn.restype, fn.argtypes = result, args
    if not dll.NDIlib_initialize():
        raise RuntimeError('Falha ao inicializar NDI nesta CPU.')
    return dll, path


def emit(**data):
    print(json.dumps(data, ensure_ascii=False), flush=True)


def send(args):
    dll, path = load_runtime()
    name = args.name.encode('utf-8')
    config = SendCreate(name, None, False, False)  # renderer supplies the cadence
    sender = dll.NDIlib_send_create(C.byref(config))
    if not sender:
        dll.NDIlib_destroy()
        raise RuntimeError('Falha ao criar fonte NDI.')
    size = args.width * args.height * 4
    pixels = C.create_string_buffer(size)
    frame = VideoFrame(args.width, args.height, int.from_bytes(b'RGBA', 'little'), args.fps, 1,
                       args.width / args.height, 1, 2**63-1, C.addressof(pixels), args.width*4, None, 0)
    sent, report_frames, report_time = 0, 0, None
    stop = threading.Event()
    renderer = None
    try:
        if args.render:
            from renderer import Renderer
            renderer = Renderer(args.width, args.height, args.fps, stop)
            def watch_parent():
                sys.stdin.buffer.read(1)
                stop.set()
            threading.Thread(target=watch_parent, daemon=True).start()
            frames = renderer.frames()
        else:
            frames = iter(lambda: sys.stdin.buffer.read(size), b'')
        emit(event='ready', source=args.name, runtime=str(path))
        for data in frames:
            if len(data) != size:
                raise RuntimeError('Quadro NDI incompleto.')
            if isinstance(data, bytearray):
                direct = (C.c_char*size).from_buffer(data)
                frame.data = C.addressof(direct)
            else:
                C.memmove(pixels, data, size)
            # Synchronous call: the frame memory can be reused only after return.
            dll.NDIlib_send_send_video_v2(sender, C.byref(frame))
            sent += 1
            if report_time is None:
                report_time = time.monotonic()
                report_frames = sent
            if sent == 1 or time.monotonic()-report_time >= 1:
                now = time.monotonic()
                emit(event='stats', frames=sent, fps=round((sent-report_frames)/max(.001, now-report_time), 1),
                     connections=dll.NDIlib_send_get_no_connections(sender, 0), renderer=renderer.ctx.info['GL_RENDERER'] if renderer else 'external')
                report_time, report_frames = now, sent
    finally:
        stop.set()
        dll.NDIlib_send_destroy(sender)
        dll.NDIlib_destroy()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--probe', action='store_true')
    parser.add_argument('--render', action='store_true')
    parser.add_argument('--name', default='Souz BG Studio')
    parser.add_argument('--width', type=int, default=1920)
    parser.add_argument('--height', type=int, default=1080)
    parser.add_argument('--fps', type=int, default=30)
    args = parser.parse_args()
    try:
        if args.probe:
            dll, path = load_runtime()
            emit(available=True, runtime=str(path))
            dll.NDIlib_destroy()
        else:
            if not (16 <= args.width <= 1920 and args.width % 2 == 0 and 16 <= args.height <= 1080 and args.fps in (25, 30, 50, 60)):
                raise ValueError('Resolução/FPS inválidos.')
            send(args)
    except Exception as error:
        emit(event='error', error=str(error))
        sys.exit(1)
