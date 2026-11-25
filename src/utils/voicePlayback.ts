/** Choose only an installed, local voice in the detected language; never change languages. */
export function localVoiceFor(language:string,voices:SpeechSynthesisVoice[]):SpeechSynthesisVoice|undefined {
 const matches=voices.filter(voice=>voice.localService&&voice.lang.toLowerCase().split(/[-_]/)[0]===language);
 return matches.find(voice=>voice.lang.toLowerCase()===language+'-in')||matches.find(voice=>voice.default)||matches[0];
}
