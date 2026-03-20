export async function generateWaveform(file: File, bars: number = 200): Promise<number[]> {
  var arrayBuffer = await file.arrayBuffer();
  var audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  var audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  var channelData = audioBuffer.getChannelData(0);
  var blockSize = Math.floor(channelData.length / bars);
  var peaks = [];
  for (var i = 0; i < bars; i++) {
    var start = i * blockSize;
    var sum = 0;
    for (var j = 0; j < blockSize; j++) {
      sum += Math.abs(channelData[start + j] || 0);
    }
    peaks.push(sum / blockSize);
  }
  var max = Math.max.apply(null, peaks) || 1;
  return peaks.map(function(p) { return p / max; });
}
