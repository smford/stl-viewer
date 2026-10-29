export class TurntableRecorder {
  private canvas: HTMLCanvasElement;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  public isRecording = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public startRecording(
    durationMs = 5000,
    onProgress?: (remainingSec: number) => void,
    onFinish?: (videoBlob: Blob) => void
  ) {
    if (this.isRecording) return;

    const stream = this.canvas.captureStream(60);
    this.recordedChunks = [];

    let mimeType = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    }

    this.mediaRecorder = new MediaRecorder(stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.isRecording = false;
      const blob = new Blob(this.recordedChunks, { type: mimeType });
      onFinish?.(blob);
    };

    this.isRecording = true;
    this.mediaRecorder.start(100);

    const startTime = performance.now();
    const interval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
      onProgress?.(remaining);

      if (elapsed >= durationMs) {
        clearInterval(interval);
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        }
      }
    }, 200);
  }
}
