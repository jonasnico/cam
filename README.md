# cam

A camera-powered musical instrument. Move your face or either hand to play a C pentatonic melody; stay still to let it fade.

## Run

```sh
pnpm install
pnpm dev
```

Open the local URL and choose **Enable camera & play**. Camera access requires localhost or HTTPS. The first start downloads MediaPipe models, so an internet connection is needed. Camera frames are processed on your device; the app does not record video or request microphone access.

## Play

- Move your head sideways to change pitch, or move a hand up and down. The strongest movement leads the melody, with a small margin to prevent jittery handoffs.
- Move more to add volume and harmonics. The right side of the mirrored camera controls brightness; the left side adds detuning. These hand roles follow screen position, not anatomical handedness.
- **Face** and **Hands** independently enable or disable those inputs. Searching, Tracked and Playing distinguish visibility from movement. Disabling an input immediately removes its musical contribution.
- **Mute** silences the entire output, including reverb and echoes. Space also toggles mute when focus is outside an interactive control.
- **Settings** contains waveform, voices, volume, tone, reverb, echo and tracking display controls. The pattern preview is illustrative, not executable Strudel code; sound is synthesized with the Web Audio API.
- **End session** releases the camera. Leaving the tab pauses audio and disables camera frames; returning requires **Resume playing** to avoid unexpected sound.

The camera view is mirrored and fitted without cropping. A face or a hand can play alone, and one tracker can remain usable if the other fails. Loading and camera errors include recovery controls. MediaPipe's WASM runtime is bundled from the installed package to keep its version consistent; GPU initialization falls back to CPU with a diagnostic warning.

## Development

```sh
pnpm test
pnpm build
pnpm preview
```

Gesture and audio regression tests use Node's built-in test runner. The production base path is `/cam/`.

Tracking processes fresh video frames at up to 20 Hz, normalizes smoothing and velocity to elapsed time, and clears stale motion when video stops. Tracking graphics reuse GPU buffers instead of rebuilding geometry every frame. Audio uses per-voice envelopes, a smoothed expression gain, reverb and feedback delay, followed by master volume, a compressor and an output mute.
