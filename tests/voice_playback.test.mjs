import test from 'node:test';
import assert from 'node:assert/strict';
import {localVoiceFor} from '../src/utils/voicePlayback.ts';
test('fast speech requires an installed local voice in the exact detected language',()=>{
 const english={lang:'en-US',localService:true,default:true};
 const india={lang:'en-IN',localService:true};
 assert.equal(localVoiceFor('en',[english,india]),india);
 assert.equal(localVoiceFor('te',[english]),undefined);
 assert.equal(localVoiceFor('hi',[{lang:'hi-IN',localService:false}]),undefined);
 assert.equal(localVoiceFor('hi',[{lang:'hi-IN',localService:true}]).lang,'hi-IN');
});
