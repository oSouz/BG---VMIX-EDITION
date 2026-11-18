"""Local integration check: discover our real NDI source and receive changing video."""
import ctypes as C
import hashlib
import json
import sys
import time
from sender import load_runtime, VideoFrame


class Source(C.Structure):
    _fields_ = [('name', C.c_char_p), ('url', C.c_char_p)]


class FindCreate(C.Structure):
    _fields_ = [('local', C.c_bool), ('groups', C.c_char_p), ('extra_ips', C.c_char_p)]


class RecvCreate(C.Structure):
    _fields_ = [('source', Source), ('color', C.c_int), ('bandwidth', C.c_int), ('fields', C.c_bool), ('name', C.c_char_p)]


def check(name, expect_red=False):
    dll, _ = load_runtime()
    signatures = {
        'NDIlib_find_create_v2': (C.c_void_p, [C.POINTER(FindCreate)]),
        'NDIlib_find_wait_for_sources': (C.c_bool, [C.c_void_p, C.c_uint32]),
        'NDIlib_find_get_current_sources': (C.POINTER(Source), [C.c_void_p, C.POINTER(C.c_uint32)]),
        'NDIlib_find_destroy': (None, [C.c_void_p]),
        'NDIlib_recv_create_v3': (C.c_void_p, [C.POINTER(RecvCreate)]),
        'NDIlib_recv_capture_v2': (C.c_int, [C.c_void_p, C.POINTER(VideoFrame), C.c_void_p, C.c_void_p, C.c_uint32]),
        'NDIlib_recv_free_video_v2': (None, [C.c_void_p, C.POINTER(VideoFrame)]),
        'NDIlib_recv_destroy': (None, [C.c_void_p]),
    }
    for symbol, (result, args) in signatures.items():
        fn = getattr(dll, symbol)
        fn.restype, fn.argtypes = result, args
    finder = dll.NDIlib_find_create_v2(C.byref(FindCreate(True, None, None)))
    if not finder:
        raise RuntimeError('Cannot create NDI finder')
    receiver = None
    try:
        deadline = time.monotonic() + 12
        source = None
        while time.monotonic() < deadline and source is None:
            dll.NDIlib_find_wait_for_sources(finder, 500)
            count = C.c_uint32()
            sources = dll.NDIlib_find_get_current_sources(finder, C.byref(count))
            for i in range(count.value):
                if name in sources[i].name.decode('utf-8'):
                    source = sources[i]
                    break
        if source is None:
            raise RuntimeError('NDI source not discovered: '+name)
        receiver = dll.NDIlib_recv_create_v3(C.byref(RecvCreate(source, 0, 100, False, b'Souz integration check')))
        if not receiver:
            raise RuntimeError('Cannot create NDI receiver')
        hashes = []
        dimensions = None
        deadline = time.monotonic() + 12
        while time.monotonic() < deadline and len(hashes) < 4:
            frame = VideoFrame()
            kind = dll.NDIlib_recv_capture_v2(receiver, C.byref(frame), None, None, 1000)
            if kind == 1:
                try:
                    dimensions = [frame.xres, frame.yres]
                    if not frame.data or frame.stride <= 0:
                        raise RuntimeError('Invalid received frame')
                    data = C.string_at(frame.data, frame.stride*frame.yres)
                    if expect_red:
                        offset = frame.stride*(frame.yres//2)+(frame.xres//2)*4
                        blue, green, red = data[offset:offset+3]
                        if not (red >= 245 and green <= 10 and blue <= 10):
                            raise RuntimeError(f'Unexpected received BGR pixel: {blue}, {green}, {red}')
                    hashes.append(hashlib.sha256(data).hexdigest())
                finally:
                    dll.NDIlib_recv_free_video_v2(receiver, C.byref(frame))
        if len(hashes) < 4 or (not expect_red and len(set(hashes)) < 2):
            raise RuntimeError('Did not receive changing video frames')
        print(json.dumps({'received': len(hashes), 'changing': len(set(hashes)) > 1, 'red_verified': expect_red, 'dimensions': dimensions}), flush=True)
    finally:
        if receiver:
            dll.NDIlib_recv_destroy(receiver)
        dll.NDIlib_find_destroy(finder)
        dll.NDIlib_destroy()


if __name__ == '__main__':
    check(sys.argv[1] if len(sys.argv) > 1 else 'Souz BG Studio', '--red' in sys.argv)
