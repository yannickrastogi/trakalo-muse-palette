import lamejs from "lamejs";

export async function encodeToMp3(file: File, bitrate: number = 128): Promise<Blob> {
  var arrayBuffer = await file.arrayBuffer();
  var audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  var audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  var numChannels = audioBuffer.numberOfChannels;
  var sampleRate = audioBuffer.sampleRate;
  var mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);
  var left = audioBuffer.getChannelData(0);
  var right = numChannels > 1 ? audioBuffer.getChannelData(1) : left;
  var sampleBlockSize = 1152;
  var mp3Data: Int8Array[] = [];
  var leftInt16 = new Int16Array(left.length);
  var rightInt16 = new Int16Array(right.length);
  for (var i = 0; i < left.length; i++) {
    leftInt16[i] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)));
    rightInt16[i] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)));
  }
  for (var i = 0; i < leftInt16.length; i += sampleBlockSize) {
    var leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    var rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
    var mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }
  var end = mp3encoder.flush();
  if (end.length > 0) {
    mp3Data.push(end);
  }
  return new Blob(mp3Data, { type: "audio/mp3" });
}
