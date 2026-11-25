# Automatic multilingual voice chat

## Two voice controls

The ordinary **microphone** dictates into the message composer; review the words and
press Send. The separate **blue waveform button** opens a dedicated voice conversation
screen. Press Speak, ask a short question, and pause: local silence detection ends the
recording after approximately 1.5 seconds without speech. Each bounded recording uses
the existing authenticated transcription and RAG answer endpoints. The answer appears
as text and plays aloud; listening resumes after playback finishes. This is a sequence
of recorded voice turns, not a real-time full-duplex audio connection.

### Quick replies

Quick replies is enabled by default in the blue conversation screen. It uses an
installed local speech voice only when it matches the detected language. In that
case the server returns the authorized text without waiting for cloud TTS; the
browser reads exactly that text. No remote browser speech voices or substitute
languages are selected. When no matching installed voice exists, cloud speech is
still used. Turn Quick replies off to prefer cloud speech or a longer pause.

Quick mode reduces the silence interval from 1.5 seconds to 0.8 seconds, and the
next-listen delay from 450 ms to 200 ms. Spoken model answers request one or two
short sentences with units, citations and safety qualifications preserved. Only
ordinary non-factory voice conversation uses minimal model thinking; machine
analysis keeps low thinking and all existing evidence checks. Exact greetings have
fixed local replies in all three languages and never read factory records. Greetings
combined with machine questions do not use that shortcut. Typed answer limits and
original SOP procedures remain unchanged.

Timing spot-check on 22 November: one synthetic English generation took 9,572 ms
before the thinking change, with a separate 2,625 ms cloud speech stage. A subsequent
generation with minimal conversational thinking took 2,738 ms. These single samples
exclude transcription and do not establish an average, SLA or guaranteed improvement
on every question. The device path eliminates the cloud speech request; actual device
playback timing still depends on the browser. Network/provider delays remain.

Verification: 26 targeted backend tests, TypeScript/build, local-voice selection tests,
and mocked browser quick English/device speech plus Telugu/cloud fallback passed.
Browser tests also passed silence submission, mute, next-turn listening and release
on close. The refreshed backend was restarted independently of the Simulator.

References: [local speech service](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService),
[available device voices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices),
[Gemini thinking levels](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-3-5-flash).

Mute cancels capture and pending requests; unmute makes Speak available again.
Interrupt and speak stops the reply before recording another question. Finish question
is available when background noise prevents silence detection. End call or closing the
assistant releases the microphone, aborts pending requests and stops playback. Each
recording remains capped at 20 seconds / 2 MiB. A silent turn stops after about eight
seconds; unclear audio produces an error rather than an endless retry loop. If Web Audio
metering is unavailable, use Finish question or the recording time limit. Browser sound
restrictions show a Play reply button. Conversation text remains in the open chat after
ending voice mode; its audio is not automatically replayed. Machine/account permissions
are unchanged, and changing machine ends the voice session.

Click the microphone and speak in Telugu, Hindi or English. No language selection is needed. Click Stop (or wait for the 20-second recording limit), review the detected transcript and press Send. Voice questions receive text and a spoken reply in the detected language. Typed questions and quick prompts remain text-only. If browser autoplay is blocked, press Play on the reply.

Voice processing uses the configured Gemini account, with the project owner's explicit approval. A recording is uploaded after recording stops for transcription and language detection; the authorized answer is then sent for speech generation. FactoryPulse keeps audio in request/browser memory, not its database or project files. This does not specify Google's own retention policy. Microphone permission and a secure context (localhost or HTTPS) are required. Closing chat or changing machine stops recording and aborts pending transcription. Native transcripts remain editable before sending.

The server requires an authenticated session for both voice endpoints, restricts recording formats and uploads to 2 MiB, and limits voice requests per user. Existing role and selected-machine authorization is reused before retrieving SQL records. Credentials and personnel records remain excluded from Gemini context. Audio generation failure leaves text visible. Unclear or unsupported speech is rejected instead of inventing a question. Automatic detection is limited to these three languages and may misrecognize accents, background noise or mixed speech; review machine IDs and numbers.

Safety SOP steps remain original catalog text, without generative translation. A short localized notice is spoken; the original procedure remains expandable below. Training guidance never replaces approved onsite instructions.

Implementation: `api_server/voice_chat.py`, authenticated `/api/v1/intelligence/transcribe` and `/api/v1/intelligence/voice-answer`, `useVoiceDictation`, `ChatAudioReply`. Existing Gemini configuration supplies the API credential. Short voice answers use the verified `gemini-3.5-flash-lite` model; typed answers retain the configured model. Automatic speech transcription uses the dedicated `gemini-3.5-transcribe` Interactions API with inline audio, `store=False`, verbatim mode and the three supported language hints; native-script detection selects the reply locale. Romanized transcripts receive a bounded language classification/transliteration pass with `gemini-3.5-flash-lite`; changed numeric values or machine IDs are rejected. Mixed speech uses Telugu/Hindi script precedence and can be misclassified. Speech generation uses `gemini-3.8-flash-lite-tts` with at most two bounded attempts. There are no new browser credentials. No telemetry pipeline or Simulator generation settings are changed by voice chat.


Verification (19 November 2026): 46 targeted mocked backend tests passed, including authentication, operator machine scope, upload bounds, rate limits, Romanized Hindi and voice-only audio. TypeScript and production build passed (existing Vite configuration and bundle-size warnings). Desktop/mobile headless browser tests used mocked microphone/provider responses: automatic three-language flow, typed replies without audio, playback controls, no selector, no horizontal overflow and microphone release on close all passed. Actual Google synthetic-speech tests generated WAV audio and transcribed English and Telugu correctly; a Romanized Hindi result exposed and prompted the language-normalization fix, then the Hindi retest returned native-script Hindi correctly. Actual Telugu and Hindi answer-plus-audio also passed. These synthetic tests do not establish accuracy with the user's microphone, background factory noise or every accent. Provider availability remains external; transient 503/504 errors were observed and produce honest text/error fallbacks.

Provider reference: https://ai.google.dev/gemini-api/docs/transcribe

## Built-in microphone acceptance — 22 November 2026

No external microphone is required when the device has a working built-in microphone.
The browser uses its default audio input; FactoryPulse does not require a language
selector. Permission-denied, missing-device and busy-device messages now include
concrete recovery steps. Replacement unavailable/invalid audio clears the previous
reply player, with text retained. Browser autoplay restrictions still require Play.

Thirteen targeted backend tests, TypeScript, production build and desktop/mobile
mocked browser voice flows passed. Typed replies were silent; all three automatic
language flows showed text/audio; closing chat released the capture tracks. These
checks did not record the user's actual microphone. A physical voice/speaker test
was requested and remains pending user confirmation. Existing bundle-size warning
remains. No telemetry or Simulator settings were changed.
