// Cross-card video coordination for the feed — pure DOM bookkeeping, no
// React state, since nothing here needs to trigger a re-render: only one
// video plays at a time, and unmuting one mutes any other.
let currentVideo: HTMLVideoElement | null = null;
let currentUnmuted: HTMLVideoElement | null = null;

export function requestPlay(video: HTMLVideoElement) {
  if (currentVideo && currentVideo !== video) {
    currentVideo.pause();
    currentVideo.currentTime = 0;
  }
  currentVideo = video;
}

export function releasePlay(video: HTMLVideoElement) {
  if (currentVideo === video) currentVideo = null;
}

export function requestUnmute(video: HTMLVideoElement) {
  if (currentUnmuted && currentUnmuted !== video) currentUnmuted.muted = true;
  currentUnmuted = video;
}
