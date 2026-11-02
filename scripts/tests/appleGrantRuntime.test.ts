import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import { appleGrantHash } from '../../supabase/functions/_shared/appleGrant';

const owner='71e0ff16-e219-43f2-b87b-e58db4a10214';
const nonce='a'.repeat(64);
const files=['supabase/functions/apple-grant/index.ts','supabase/functions/_shared/appleGrantRuntime.ts',
  'supabase/functions/_shared/appleGrant.ts','supabase/functions/_shared/appleGrantCrypto.ts',
  'supabase/functions/_shared/appleGrantClientSecret.ts','supabase/functions/_shared/launchHandlers.ts'];
const sources=new Map(files.map(file=>[resolve(file),readFileSync(file,'utf8')]));
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
async function harness(mint=false) {
  const events:string[]=[],calls:{name:string;args:Record<string,unknown>}[]=[],jwtOptions:unknown[]=[];
  const state={saved:false,authError:false,dbError:false};
  const env:Record<string,string>={SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',
    STRIDEOS_APPLE_CLIENT_ID:'synthetic.app',STRIDEOS_APPLE_CLIENT_SECRET:'synthetic-static'};
  if(mint) Object.assign(env,{STRIDEOS_APPLE_PRIVATE_KEY:'synthetic-key',STRIDEOS_APPLE_KEY_ID:'KEY',STRIDEOS_APPLE_TEAM_ID:'TEAM'});
  const digest=await appleGrantHash(nonce);
  let handler:((req:Request)=>Promise<Response>)|undefined;
  const admin={auth:{getUser:async(token:string)=>{
    assert.equal(token,'synthetic-session');events.push('auth');
    return state.authError?{data:{user:null},error:{}}:{data:{user:{id:owner,identities:[{provider:'apple',provider_id:'apple-sub'}]}},error:null};
  }},rpc:async(name:string,args:Record<string,unknown>)=>{
    events.push(name);calls.push({name,args:clone(args)});
    if(state.dbError) return {data:null,error:{message:'private backend error'}};
    if(name==='mark_stride_apple_capture_uncertain') return {data:true,error:null};
    assert.equal(args.owner_id,owner);assert.equal(args.apple_subject,'apple-sub');assert.equal(args.client_id,'synthetic.app');
    assert.equal(args.code_hash,await appleGrantHash('synthetic-code'));
    if(name==='stride_apple_grant_captured') return {data:state.saved,error:null};
    if(name==='reserve_stride_apple_capture') return {data:'71e0ff16-e219-43f2-b87b-e58db4a10215',error:null};
    assert.equal(args.capture_id,'71e0ff16-e219-43f2-b87b-e58db4a10215');
    assert.equal(name,'store_stride_apple_grant');state.saved=true;return {data:true,error:null};
  }};
  const modules=new Map<string,{exports:any}>();
  const context=vm.createContext({URL,URLSearchParams,Request,Response,Headers,TextEncoder,TextDecoder,Uint8Array,
    AbortController,setTimeout,clearTimeout,crypto:webcrypto,
    Deno:{env:{get:(key:string)=>env[key]},serve:(value:typeof handler)=>{handler=value;}},
    fetch:async(url:string,init:RequestInit)=>{
      assert.equal(url,'https://appleid.apple.com/auth/token');assert.equal(init.redirect,'error');events.push('exchange');
      const form=new URLSearchParams(String(init.body));assert.equal(form.get('client_secret'),mint?'synthetic-signed':'synthetic-static');
      return new Response(JSON.stringify({refresh_token:'synthetic-refresh',access_token:'synthetic-access',id_token:'synthetic-exchanged',token_type:'Bearer',expires_in:3600}));
    },
  });
  function load(file:string):any {
    const absolute=resolve(file);if(modules.has(absolute)) return modules.get(absolute)!.exports;
    const source=sources.get(absolute);assert.ok(source,`Unexpected module ${absolute}`);
    const module={exports:{}};modules.set(absolute,module);
    const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const requireMock=(id:string):any=>{
      if(id==='https://esm.sh/@supabase/supabase-js@2.48.0') return {createClient:(url:string,key:string,options:unknown)=>{
        assert.equal(url,env.SUPABASE_URL);assert.equal(key,env.SUPABASE_SERVICE_ROLE_KEY);
        assert.deepEqual(clone(options),{auth:{persistSession:false,autoRefreshToken:false}});return admin;
      }};
      if(id==='https://esm.sh/jose@6.1.3') return {
        createRemoteJWKSet:(url:URL,options:unknown)=>{assert.equal(String(url),'https://appleid.apple.com/auth/keys');assert.deepEqual(clone(options),{timeoutDuration:10000});return 'jwks';},
        jwtVerify:async(token:string,keys:string,options:unknown)=>{
          assert.ok(['synthetic-native','synthetic-exchanged'].includes(token));assert.equal(keys,'jwks');jwtOptions.push(clone(options));
          return {payload:{iss:'https://appleid.apple.com',aud:'synthetic.app',sub:'apple-sub',exp:Math.floor(Date.now()/1000)+300,nonce:digest}};
        },
        importPKCS8:async(key:string,algorithm:string)=>{assert.equal(key,'synthetic-key');assert.equal(algorithm,'ES256');return 'key';},
        SignJWT:class {
          constructor(claims:any){assert.equal(claims.iss,'TEAM');assert.equal(claims.sub,'synthetic.app');assert.equal(claims.aud,'https://appleid.apple.com');assert.equal(claims.exp-claims.iat,305);events.push('mint');}
          setProtectedHeader(header:unknown){assert.deepEqual(clone(header),{alg:'ES256',kid:'KEY'});return this;}
          async sign(key:string){assert.equal(key,'key');return 'synthetic-signed';}
        },
      };
      assert.ok(id.startsWith('.'));return load(resolve(dirname(absolute),id));
    };
    new vm.Script(`(function(require,module,exports){${code}\n})`).runInContext(context)(requireMock,module,module.exports);
    return module.exports;
  }
  load(files[0]!);assert.ok(handler);
  const request=()=>new Request('https://fixture.invalid/apple-grant',{method:'POST',headers:{authorization:'Bearer synthetic-session',apikey:'synthetic-anon-gateway'},
    body:JSON.stringify({authorizationCode:'synthetic-code',identityToken:'synthetic-native',nonce})});
  return {request,run:()=>handler!(request()),state,events,calls,jwtOptions};
}
test('actual deployed entrypoint wires verified Auth, fixed Apple JWKS claims, exact RPC arguments and only captured response',async()=>{
  const h=await harness();const r=await h.run();assert.equal(r.status,200);assert.deepEqual(await r.json(),{captured:true});
  assert.deepEqual(h.jwtOptions,Array.from({length:2},()=>({issuer:'https://appleid.apple.com',audience:'synthetic.app',algorithms:['RS256']})));
  assert.deepEqual(h.events,['auth','stride_apple_grant_captured','reserve_stride_apple_capture','exchange','store_stride_apple_grant']);
  assert.equal(Object.keys(h.calls[2]!.args.token_response as object).length,5);
  const again=await h.run();assert.equal(again.status,200);assert.equal(h.events.filter(e=>e==='exchange').length,1);
});
test('actual runtime mints server-only client secret from key/team/keyId, preserving the public contract',async()=>{
  const h=await harness(true);const r=await h.run();assert.deepEqual(await r.json(),{captured:true});assert.ok(h.events.includes('mint'));
  assert.doesNotMatch(JSON.stringify(h.calls),/synthetic-key|synthetic-signed|synthetic-static|synthetic-service/);
});
test('actual runtime rejects authentication/database failures without exchanging or exposing private details',async()=>{
  for(const mode of ['authError','dbError'] as const){const h=await harness();h.state[mode]=true;const r=await h.run();
    assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private|synthetic|token_response/);assert.ok(!h.events.includes('exchange'));}
});
