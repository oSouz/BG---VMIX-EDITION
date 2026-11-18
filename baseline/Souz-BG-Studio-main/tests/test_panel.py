import concurrent.futures
import http.client
import json
import socket
import subprocess
import sys
import time
from pathlib import Path

import os, tempfile
presets_dir = tempfile.TemporaryDirectory()
presets_file = Path(presets_dir.name) / 'sub' / 'backgrounds.txt'  # folder created on first save
p = subprocess.Popen([sys.argv[1]], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True,
                     env={**os.environ, 'SOUZ_PRESETS_FILE': str(presets_file)})
try:
    port1, token1, port2, token2 = p.stdout.readline().split()
    port1, port2 = int(port1), int(port2)
    def request(port, token=None, path='/api/state', body=None, headers=None):
        c = http.client.HTTPConnection('127.0.0.1', port, timeout=3)
        h = {'X-Souz-Token': token} if token else {}
        if body is not None: h['Content-Type'] = 'text/plain'
        if headers: h.update(headers)
        c.request('GET' if body is None else 'POST', path, body, h)
        r = c.getresponse(); result = r.status, r.read(); c.close(); return result
    def state(port=port1, token=token1):
        status, body = request(port, token); assert status == 200
        return json.loads(body)['speed']
    def command(s):
        p.stdin.write(s+'\n'); p.stdin.flush(); return p.stdout.readline().strip()
    assert abs(state()-.35)<1e-5
    assert request(port1, path='/')[0] == 200
    assert request(port1, path='/?tablet=1')[0] == 200
    assert b'<title>Souz Content-BG' in request(port1, path='/')[1]
    assert request(port1)[0] == 403
    assert request(port1, token2)[0] == 403
    assert request(port1, token1, '/api/speed', '0.75')[0] == 200
    assert state() == .75 and abs(state(port2,token2)-.35)<1e-5
    assert command('host 0.2') == 'ok' and abs(state()-.2)<1e-5
    for bad in ['nan', 'inf', '-1', '1.1', '0.5junk', '1'*2049, '']:
        assert request(port1, token1, '/api/speed', bad)[0] == 400, bad
    # Every replacement engine is available over HTTP; old maximum is no longer a cap.
    engines=105  # web/engine-catalog.json
    for engine in range(engines):
        assert request(port1,token1,'/api/params',f'Engine {engine}')[0]==200
        assert json.loads(request(port1,token1)[1])['params']['Engine']==engine
    assert request(port1, token1, '/api/speed', '.5', {'Origin':'http://evil.example'})[0] == 403
    assert request(port1, token1, '/api/speed', '.5', {'Origin':f'http://127.0.0.1:{port1}'})[0] == 200
    assert request(port1, token1, '/api/speed', '.5', {'Content-Type':'application/json'})[0] == 400
    # Reject oversized content before its body arrives, but preserve the HTTP
    # response while the sender finishes sending. Regression for WinError 10054.
    oversized=socket.create_connection(('127.0.0.1',port1));oversized.settimeout(3)
    oversized.sendall(f'POST /api/speed HTTP/1.1\r\nHost: 127.0.0.1:{port1}\r\nX-Souz-Token: {token1}\r\nContent-Type: text/plain\r\nContent-Length: 2049\r\n\r\n'.encode())
    reply=http.client.HTTPResponse(oversized);reply.begin();assert reply.status==400
    oversized.sendall(b'1'*2049);oversized.shutdown(socket.SHUT_WR)
    assert json.loads(reply.read())['error']=='invalid request'
    reply.close();oversized.close();assert state()==.5
    # A peer that ignores the half-close must not occupy a slot indefinitely.
    idle_after_reply=socket.create_connection(('127.0.0.1',port1));idle_after_reply.settimeout(3)
    idle_after_reply.sendall(f'GET /api/state HTTP/1.1\r\nHost: 127.0.0.1:{port1}\r\nX-Souz-Token: {token1}\r\n\r\n'.encode())
    idle_reply=http.client.HTTPResponse(idle_after_reply);idle_reply.begin();assert idle_reply.status==200;idle_reply.read()
    assert state()==.5
    idle_reply.close();idle_after_reply.close()
    # Every channel maps by its real SDK name; options are indices, not normalized sliders.
    all_params=json.loads(request(port1,token1)[1])['params'];assert len(all_params)==28
    for name in all_params:
        value=104 if name=='Engine' else 4 if name=='Mirror' else 13 if name=='Shape' else 8 if name=='ColorizePalette' else 2 if name=='ColorizeMode' else 1 if name in ('Reverse','Invert','Warp','Seed','Pulse') else .61
        assert request(port1,token1,'/api/params',f'{name} {value}')[0]==200,name
        assert abs(json.loads(request(port1,token1)[1])['params'][name]-value)<1e-5,name
    for body in ['Engine 105','PositionX 1.5','Mirror 5','Mirror 0.5','Shape 0.5','ColorizePalette 9','Reverse 0.2','Unknown 1','OpenPanel 1','Scale nan','Scale 0.3\nScale 0.4','Engine 4\nUnknown 1']:
        before=json.loads(request(port1,token1)[1])['params']
        assert request(port1,token1,'/api/params',body)[0]==400,body
        assert before==json.loads(request(port1,token1)[1])['params']
    for removed in ['Shape','Seed','ColorShift','Invert','TintBlack','TintWhite','ColorizeMode','ColorizeColor','ColorizePalette']:
        assert removed not in all_params
        assert request(port1,token1,'/api/params',removed+' 0')[0]==400
    # PVW -> PGM TAKE: complete scene, strict validation, queued until the render
    # thread commits it, busy (409) until the crossfade finishes, then unlocked.
    request(port1,token1,'/api/params','Engine 0')
    scene_values={**{n:(.42 if n not in ('Engine','Warp','Reverse','Pulse','Mirror') else 0) for n in all_params},'Engine':57,'PositionX':.25,'Reverse':1,'Mirror':2}
    take_body='Duration 2.5\nTime 12.5\n'+'\n'.join(f'{n} {v}' for n,v in scene_values.items())
    idle=json.loads(request(port1,token1)[1])['scene'];assert idle['status']==0 and len(idle['from'])==28
    for bad in [take_body.replace('Duration 2.5','Duration 0.05'),take_body.replace('Duration 2.5','Duration 11'),
                take_body.replace('Time 12.5','Time nan'),take_body.replace('Engine 57','Engine 105'),
                take_body.replace('\nPositionY 0.42',''),take_body+'\nScale 0.3',take_body+'\nUnknown 1',
                take_body.replace('Duration 2.5\n',''),take_body.replace('Time 12.5\n','')]:
        assert request(port1,token1,'/api/take',bad)[0]==400,bad
        assert json.loads(request(port1,token1)[1])['scene']['status']==0
    assert request(port1,None,'/api/take',take_body)[0]==403
    assert request(port1,token1,'/api/take',take_body,{'Content-Type':'application/json'})[0]==400
    status,body=request(port1,token1,'/api/take',take_body);assert status==200
    scene=json.loads(body)['scene'];assert scene['status']==1 and scene['duration']==2.5
    assert json.loads(body)['params']['Engine']==0, 'TAKE must not touch PGM before the render thread commits'
    assert request(port1,token1,'/api/take',take_body)[0]==409
    gen,duration,clock=command('commit').split();assert int(gen)>0 and float(duration)==2.5 and float(clock)==12.5
    live=json.loads(request(port1,token1)[1]);scene=live['scene']
    assert scene['status']==3 and scene['from']['Engine']==0 and scene['oldTime']==7.5
    assert live['params']['Engine']==57 and live['params']['PositionX']==.25 and live['params']['Reverse']==1
    assert request(port1,token1,'/api/take',take_body)[0]==409
    assert command(f'publish {gen} 0.5 0')=='ok';scene=json.loads(request(port1,token1)[1])['scene']
    assert scene['status']==3 and scene['progress']==.5 and scene['oldTime']==8.25
    assert command(f'publish {gen} 1 1')=='ok';assert json.loads(request(port1,token1)[1])['scene']['status']==0
    assert request(port1,token1,'/api/take',take_body)[0]==200;assert command('commit').split()[0]!='0'
    # A fade nobody publishes (clip stopped) unlocks TAKE after 2 s.
    assert request(port1,token1,'/api/take',take_body)[0]==409
    time.sleep(2.1);assert json.loads(request(port1,token1)[1])['scene']['status']==0
    assert request(port1,token1,'/api/take',take_body)[0]==200
    time.sleep(2.1);assert request(port1,token1,'/api/take',take_body)[0]==200, 'stale queued TAKE must be replaceable'
    assert command('commit').split()[0]!='0';assert command('commit').split()[0]=='0'
    request(port1,token1,'/api/params','\n'.join(f'{n} {v}' for n,v in {**scene_values,'Engine':0,'Reverse':0,'PositionX':.5,'PositionY':.5,'Mirror':0,'Twist':.5,'Stretch':.5,'Ripple':0,'Vignette':0,'Grain':0,'Posterize':0}.items()))
    request(port1,token1,'/api/speed','.5')
    # Saved backgrounds: strict body, same name replaces, shared by both instances, file survives.
    assert request(port1,None,'/api/presets')[0]==403
    status,body=request(port1,token1,'/api/presets');assert status==200 and json.loads(body)=={'max':100,'presets':[]}
    preset_values={**scene_values,'Engine':12,'Scale':.75}
    preset_body=lambda name,vals=preset_values:f'Name {name}\n'+'\n'.join(f'{n} {v}' for n,v in vals.items())
    for bad in [preset_body('').replace('Name \n','Name\n'),preset_body(' lead'),preset_body('trail '),preset_body('a'*121),
                preset_body('Tab\there'),preset_body('ok').replace('\nEngine 12',''),preset_body('ok')+'\nScale 0.3',
                preset_body('ok')+'\nUnknown 1',preset_body('ok').replace('Engine 12','Engine 105'),
                preset_body('ok')+'\nName again','\n'.join(f'{n} {v}' for n,v in preset_values.items())]:
        assert request(port1,token1,'/api/presets',bad)[0]==400,bad
    assert request(port1,token1,'/api/presets',preset_body('ok'),{'Content-Type':'application/json'})[0]==400
    assert not presets_file.exists(), 'rejected bodies must not create the file'
    status,body=request(port1,token1,'/api/presets',preset_body('Abertura do culto ✨').encode())
    assert status==200,body;saved=json.loads(body)['presets']
    assert len(saved)==1 and saved[0]['id']==1 and saved[0]['name']=='Abertura do culto ✨'
    assert saved[0]['values']['Engine']==12 and saved[0]['values']['Scale']==.75 and len(saved[0]['values'])==28
    assert request(port1,token1,'/api/presets',preset_body('Louvor'))[0]==200
    status,body=request(port2,token2,'/api/presets');assert [x['name'] for x in json.loads(body)['presets']]==['Abertura do culto ✨','Louvor']
    status,body=request(port2,token2,'/api/presets',preset_body('Louvor',{**preset_values,'Engine':3}))
    listed=json.loads(body)['presets'];assert [(x['id'],x['values']['Engine']) for x in listed]==[(1,12),(2,3)], 'same name replaces in place'
    for bad in ['Id','Id x','Id 1 ','Id -1','Id 1234567890','Ident 1']:
        assert request(port1,token1,'/api/presets/delete',bad)[0]==400,bad
    assert request(port1,token1,'/api/presets/delete','Id 99')[0]==404
    status,body=request(port1,token1,'/api/presets/delete','Id 1');assert status==200 and [x['id'] for x in json.loads(body)['presets']]==[2]
    assert request(port1,token1,'/api/presets',preset_body('Nova'))[0]==200
    assert [x['id'] for x in json.loads(request(port1,token1,'/api/presets')[1])['presets']]==[2,3]
    # Files from other versions: unknown/missing/invalid parameters and damaged entries.
    text=presets_file.read_text(encoding='utf-8');assert text.startswith('SOUZ-BG-STUDIO-BACKGROUNDS 1\n')
    presets_file.write_text(text.replace('Scale 0.75\n','Scale 7\nFuture 1\n',1).replace('Mirror 2\n','',1)+'Preset 9\nName  bad\nEnd\nPreset x\nName y\nEnd\n',encoding='utf-8')
    listed=json.loads(request(port1,token1,'/api/presets')[1])['presets'];assert [x['id'] for x in listed]==[2,3]
    assert listed[0]['values']['Scale']==.5 and listed[0]['values']['Mirror']==0 and 'Future' not in listed[0]['values']
    for i in range(98):assert request(port1,token1,'/api/presets',preset_body(f'Cena {i}'))[0]==200
    assert request(port1,token1,'/api/presets',preset_body('Cheia'))[0]==409
    assert request(port1,token1,'/api/presets',preset_body('Cena 5'))[0]==200, 'replacing works when full'
    big=request(port1,token1,'/api/presets');assert big[0]==200 and len(json.loads(big[1])['presets'])==100
    presets_file.unlink();assert json.loads(request(port1,token1,'/api/presets')[1])['presets']==[]
    info = json.loads(request(port1,token1,'/api/info')[1]); assert info['port']==port1 and info['urls'] and info['revision']==(Path(__file__).resolve().parents[1]/'VERSION').read_text().strip()
    fade=json.loads(request(port1,token1)[1])['fade'];assert fade['progress']==1 and fade['duration']==.6 and fade['from']==0 and fade['to']==0
    # Authenticated preview lease, binary roundtrip, isolation and stale eviction.
    assert request(port1,token1,'/api/preview')[0]==204
    assert request(port1,None,'/api/preview/start','')[0]==403
    status,body=request(port1,token1,'/api/preview/start','')
    assert status==200
    publisher=json.loads(body)['publisher']
    assert request(port1,token1,'/api/preview/start','')[0]==409
    jpeg=b'\xff\xd8'+bytes(range(256))*100+b'\xff\xd9'
    frame_headers={'Content-Type':'image/jpeg','X-Souz-Publisher':publisher}
    assert request(port1,token1,'/api/preview/frame',jpeg,frame_headers)[0]==200
    assert request(port1,token1,'/api/preview')==(200,jpeg)
    assert request(port2,token2,'/api/preview')[0]==204
    assert request(port1,token1,'/api/preview/frame',jpeg,{'Content-Type':'image/jpeg','X-Souz-Publisher':'wrong'})[0]==409
    assert request(port1,token1,'/api/preview/frame',b'bad',frame_headers)[0]==400
    assert request(port1,token1,'/api/preview/stop','',{'X-Souz-Publisher':'wrong'})[0]==409
    assert request(port1,token1,'/api/preview/stop','',{'X-Souz-Publisher':publisher})[0]==200
    assert request(port1,token1,'/api/preview')[0]==204
    status,body=request(port1,token1,'/api/preview/start','')
    frame_headers['X-Souz-Publisher']=json.loads(body)['publisher']
    assert request(port1,token1,'/api/preview/frame',jpeg,frame_headers)[0]==200
    time.sleep(3.1)
    assert request(port1,token1,'/api/preview')[0]==204
    lan_urls=[u for u in info['urls'] if not u.startswith('http://127.')]
    if lan_urls:
        from urllib.parse import urlparse
        lan=urlparse(lan_urls[0]);c=http.client.HTTPConnection(lan.hostname,lan.port,timeout=3)
        c.request('GET','/api/state',headers={'X-Souz-Token':token1});response=c.getresponse();assert response.status==200;assert 'params' in json.loads(response.read());c.close()
    # One-use pairing code, bounded guesses, separate instance and no auth bypass.
    assert request(port1,None,'/api/pair/start','')[0]==403
    status,body=request(port1,token1,'/api/pair/start','');assert status==200
    code=json.loads(body)['code'];assert len(code)==6 and code.isdigit()
    assert request(port2,None,'/api/pair',code)[0]==403
    assert request(port1,None,'/api/pair',code,{'Origin':'http://evil.example'})[0]==403
    status,body=request(port1,None,'/api/pair',code);assert status==200 and json.loads(body)['token']==token1
    assert request(port1,None,'/api/pair',code)[0]==403
    status,body=request(port1,token1,'/api/pair/start','');code=json.loads(body)['code']
    wrong='000000' if code!='000000' else '111111'
    for attempt in range(5):assert request(port1,None,'/api/pair',wrong)[0]==403
    assert request(port1,None,'/api/pair',code)[0]==403
    status,body=request(port1,token1,'/api/pair/start','');code=json.loads(body)['code']
    assert request(port1,None,'/api/pair',code)[0]==200
    assert request(port1,None,'/api/params','Speed 1')[0]==403
    # Incomplete clients cannot block other clients or shutdown.
    slow = socket.create_connection(('127.0.0.1',port1)); slow.sendall(b'GET / HTTP/1.1\r\n')
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        assert all(pool.map(lambda _: state() == .5, range(40)))
    # Fragmented request body is assembled before committing the value.
    s=socket.create_connection(('127.0.0.1',port1));s.settimeout(3)
    s.sendall(f'POST /api/speed HTTP/1.1\r\nHost: 127.0.0.1:{port1}\r\nX-Souz-Token: {token1}\r\nContent-Type: text/plain\r\nContent-Length: 3\r\n\r\n0'.encode())
    time.sleep(.03); assert state() == .5
    s.sendall(b'.8'); assert b'200 OK' in s.recv(4096);s.close();assert abs(state()-.8)<1e-5
    # Idle socket gets evicted after its absolute deadline.
    time.sleep(2.1);slow.settimeout(1);assert slow.recv(1)==b'';slow.close()
    hanging=socket.create_connection(('127.0.0.1',port1));hanging.sendall(b'GET /')
    start=time.monotonic();assert command('stop1')=='stopped';assert time.monotonic()-start<1
    hanging.close()
    assert abs(state(port2,token2)-.35)<1e-5
    try:
        socket.create_connection(('127.0.0.1',port1),timeout=.2)
        raise AssertionError('removed instance still listening')
    except OSError: pass
    p.stdin.write('quit\n');p.stdin.flush();assert p.wait(timeout=3)==0
    print('PASS: HTTP, embedded UI, auth, validation, TAKE (queue, strict body, busy, unlock), host updates, two instances, concurrent clients, fragmented requests, deadlines, shutdown and restart, saved backgrounds (strict body, replace, shared file, limits)')
finally:
    if p.poll() is None: p.kill();p.wait()
