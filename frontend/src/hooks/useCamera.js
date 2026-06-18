/**
 * Custom hook for managing webcam access and face capture.
 *
 * SIMPLE, RELIABLE approach:
 * - Gets the camera stream via getUserMedia
 * - Connects it to the video element
 * - Relies on `autoPlay` attribute on <video> for playback
 * - Sets isActive immediately so the UI doesn't hang
 * - Captures frames via canvas from the live video
 */
import { useState, useCallback, useRef, useEffect } from 'react';

const useCamera = ({ autoStart = false, facingMode = 'user' } = {}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);

  /**
   * Stop the camera and release all tracks.
   */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  /**
   * Start the camera stream.
   */
  const startCamera = useCallback(async () => {
    try {
      setError(null);

      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      if (!mountedRef.current) return;

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;

      // Connect stream to video element — autoPlay on the element handles playback
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Mark as active immediately. Don't wait for events —
      // autoPlay on the <video> element handles rendering.
      if (mountedRef.current) {
        setIsActive(true);
        setHasPermission(true);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setIsActive(false);

      if (err.name === 'NotAllowedError') {
        setHasPermission(false);
        setError('Camera permission denied. Allow camera access in browser settings and reload.');
      } else if (err.name === 'NotFoundError') {
        setHasPermission(false);
        setError('No camera found. Connect a camera and try again.');
      } else if (err.name === 'NotReadableError') {
        setHasPermission(true);
        setError('Camera is busy. Close other apps using it (Zoom, Teams, etc.), then Try Again.');
      } else {
        setHasPermission(false);
        setError(`Camera error: ${err.message}`);
      }
    }
  }, [facingMode]);

  /**
   * Capture a frame from the live video as a base64 JPEG.
   */
  const captureImage = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isActive) return null;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;
    if (video.readyState < 2) return null; // HAVE_CURRENT_DATA or better

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    return canvas.toDataURL('image/jpeg', 0.92);
  }, [isActive]);

  /**
   * Mount / unmount lifecycle.
   */
  useEffect(() => {
    mountedRef.current = true;

    let timer;
    if (autoStart) {
      timer = setTimeout(() => {
        if (mountedRef.current) startCamera();
      }, 150);
    }

    return () => {
      mountedRef.current = false;
      if (timer) clearTimeout(timer);
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { videoRef, isActive, error, hasPermission, startCamera, stopCamera, captureImage };
};

export default useCamera;
