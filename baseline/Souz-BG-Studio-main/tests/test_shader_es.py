import ctypes as c,os,json,re
from pathlib import Path
os.environ['EGL_PLATFORM']='surfaceless'
e=c.CDLL('libEGL.so.1');g=c.CDLL('libGL.so.1')
def fn(lib,n,ret,args):
 f=getattr(lib,n);f.restype=ret;f.argtypes=args;return f
ptr=c.c_void_p;I=c.c_int;U=c.c_uint
D=fn(e,'eglGetDisplay',ptr,[ptr])(None)
assert fn(e,'eglInitialize',U,[ptr,ptr,ptr])(D,None,None)
assert fn(e,'eglBindAPI',U,[U])(0x30A0)
attrs=(I*7)(0x3033,1,0x3040,0x40,0x3024,8,0x3038);config=ptr();num=I()
assert fn(e,'eglChooseConfig',U,[ptr,ptr,ptr,I,ptr])(D,attrs,c.byref(config),1,c.byref(num)) and num.value
ctx=fn(e,'eglCreateContext',ptr,[ptr,ptr,ptr,ptr])(D,config,None,(I*3)(0x3098,3,0x3038));assert ctx
assert fn(e,'eglMakeCurrent',U,[ptr,ptr,ptr,ptr])(D,None,None,ctx)
s=(Path(__file__).resolve().parents[1]/'web/panel.html').read_text();parts=json.loads(re.search(r'const PREVIEW_PARTS=(.*);',s).group(1))
for index,body in enumerate(parts['engines']):
 shader=parts['common']+body
 assert len(re.findall(r'vec3 eng_\w+\(',shader))==1
 a=fn(g,'glCreateShader',U,[U])(0x8B30);src=c.c_char_p(shader.encode());fn(g,'glShaderSource',None,[U,I,ptr,ptr])(a,1,c.byref(src),None);fn(g,'glCompileShader',None,[U])(a);ok=I();fn(g,'glGetShaderiv',None,[U,U,ptr])(a,0x8B81,c.byref(ok));buf=c.create_string_buffer(20000);fn(g,'glGetShaderInfoLog',None,[U,I,ptr,ptr])(a,20000,None,buf);assert ok.value,(index,buf.value.decode())
 fn(g,'glDeleteShader',None,[U])(a)
assert len(parts['engines'])==105
print(f"PASS: all {len(parts['engines'])} specialized GLSL ES shaders compile; each contains exactly one engine")
