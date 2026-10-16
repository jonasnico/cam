import GUI from 'lil-gui';
import { SYNTH_TYPES, updateOscillators } from '../audio/strudel.js';

export function createSettingsPanel(audioSettings, settings) {
  const gui = new GUI({ container: document.getElementById('settings-controls'), title: 'Sound' });
  const updateVoices = () => updateOscillators(audioSettings.synthType, audioSettings.oscillatorCount);
  gui.add(audioSettings, 'synthType', SYNTH_TYPES).name('Waveform').onChange(updateVoices);
  gui.add(audioSettings, 'oscillatorCount', 1, 4, 1).name('Voices').onChange(updateVoices);
  gui.add(audioSettings, 'masterVolume', 0, 1, 0.01).name('Volume');

  const filter = gui.addFolder('Tone');
  filter.add(audioSettings, 'filterCutoff', 10, 100, 1).name('Brightness');
  filter.add(audioSettings, 'filterResonance', 0.1, 8, 0.1).name('Resonance');
  filter.close();

  const effects = gui.addFolder('Space & echo');
  effects.add(audioSettings, 'reverbMix', 0, 1, 0.01).name('Reverb');
  effects.add(audioSettings, 'delayMix', 0, 0.6, 0.01).name('Echo level');
  effects.add(audioSettings, 'delayTime', 0.05, 1, 0.01).name('Echo time');
  effects.add(audioSettings, 'delayFeedback', 0, 0.7, 0.01).name('Echo repeats');
  effects.close();

  const view = gui.addFolder('View');
  view.add(settings, 'showOverlay').name('Tracking marks');
  view.add(settings, 'showCode').name('Pattern preview');
  view.close();
  return gui;
}
