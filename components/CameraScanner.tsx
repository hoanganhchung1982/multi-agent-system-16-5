import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, RotateCcw, Check, X, AlertCircle, SearchPlus, SearchMinus } from 'lucide-react';
import Cropper from 'react-easy-crop'; // Import thư viện Cropper
import { Area } from 'react-easy-crop/types'; // Import kiểu dữ liệu cho vùng cắt

interface CameraScannerProps {
  onCapture: (base64Data: string) => void;
  onClose: () => void;
}

// Hàm trợ giúp để cắt ảnh từ Base64
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // Needed for cross-origin images
    image.src = url;
  });

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context for canvas');
  }

  const rotation = 0; // Keeping rotation at 0 for simplicity, can be extended if needed

  const rotateRadian = rotation * (Math.PI / 180);

  // Set canvas size to match the crop area
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Translate and rotate canvas to apply crop correctly
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rotateRadian);
  ctx.scale(1, 1); // No scaling needed here, handled by drawImage
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  // Draw the image onto the canvas, cropped to the specified area
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // As a blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      if (file) {
        resolve(URL.createObjectURL(file));
      } else {
        reject(new Error('Canvas is empty'));
      }
    }, 'image/jpeg', 0.8);
  });
}


const CameraScanner: React.FC<CameraScannerProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [countdown, setCountdown] = useState<number | null>(10);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // States cho Cropper
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const startCamera = async () => {
    try {
      setCountdown(10); // Đặt lại bộ đếm khi khởi động camera
      setCapturedImage(null);
      setError(null);
      stopCamera(); // Đảm bảo stop camera cũ trước khi start cái mới

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => console.error("Error playing video:", err));
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Không thể truy cập camera. Vui lòng cấp quyền.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  useEffect(() => {
    let timer: number;
    if (countdown !== null && countdown > 0 && !capturedImage && !error) {
      timer = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0 && !capturedImage && !error) {
      captureImage();
    }
    return () => clearTimeout(timer);
  }, [countdown, capturedImage, error]);

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Đảm bảo video đã tải đủ metadata để có videoWidth/Height
      if (video.readyState < 2) {
        video.addEventListener('loadedmetadata', () => captureImage(), { once: true });
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.9); // Tăng chất lượng ảnh lên 0.9
        setCapturedImage(base64);
        setCountdown(null);
        stopCamera();
        // Reset cropper states khi có ảnh mới
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setCroppedAreaPixels(null);
      }
    }
  };

  const handleRetry = () => {
    setCapturedImage(null);
    startCamera();
  };

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (capturedImage && croppedAreaPixels) {
      try {
        // Lấy ảnh đã cắt từ hàm trợ giúp
        const croppedImageBase64 = await getCroppedImg(capturedImage, croppedAreaPixels);
        onCapture(croppedImageBase64);
      } catch (e) {
        console.error("Error getting cropped image:", e);
        // Có thể hiển thị thông báo lỗi cho người dùng
      }
    } else if (capturedImage) { // Nếu không crop (chỉ chụp), gửi ảnh gốc
        onCapture(capturedImage);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in fade-in duration-300">
      {!capturedImage ? (
        // Giao diện Camera (chưa chụp)
        <div className="relative w-full h-full flex flex-col items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          
          {/* Overlay Rectangular Frame */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-[85%] h-[30%] md:w-[60%] md:h-[40%] border-[4px] border-emerald-400 rounded-[2rem] shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] relative">
              {/* Corner Accents */}
              <div className="absolute -top-2 -left-2 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl"></div>
              <div className="absolute -top-2 -right-2 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl"></div>
              <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl"></div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl"></div>
              
              {/* Scanning Line Animation */}
              {!error && (
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400/50 shadow-[0_0_15px_rgba(52,211,153,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
              )}
            </div>
          </div>

          {/* Countdown Display */}
          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-[12rem] font-black text-white/90 drop-shadow-2xl animate-pulse">
                {countdown}
              </span>
            </div>
          )}

          {error && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-8 rounded-[2rem] text-center max-w-xs shadow-2xl">
              <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
              <p className="font-bold text-slate-800 mb-6">{error}</p>
              <button onClick={startCamera} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold uppercase text-xs tracking-widest">Thử lại</button>
            </div>
          )}

          <div className="absolute bottom-12 left-0 right-0 px-10 flex justify-between items-center text-white">
            <button onClick={onClose} className="p-4 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-all">
              <X className="w-6 h-6" />
            </button>
            <button
              onClick={captureImage}
              className="p-6 bg-emerald-500 rounded-full border-4 border-white/20 shadow-lg active:scale-95 transition-all"
            >
              <Camera className="w-8 h-8 text-white" />
            </button>
            <div className="w-14 h-14" /> {/* Spacer */}
          </div>
        </div>
      ) : (
        // Giao diện Crop ảnh (sau khi chụp)
        <div className="w-full h-full flex flex-col bg-slate-950 p-6 md:p-12 animate-in zoom-in-95 duration-500">
          <div className="flex-1 flex flex-col items-center justify-center gap-8 relative">
            <div className="relative w-full h-full max-w-2xl max-h-[80vh] bg-black rounded-[3rem] overflow-hidden border-4 border-white/10 shadow-2xl">
              {/* Cropper */}
              {capturedImage && (
                <Cropper
                  image={capturedImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={4 / 3} // Tỷ lệ ảnh cố định (ví dụ: 4:3) hoặc để undefined để tự do
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                  restrictPosition={false} // Cho phép kéo ảnh ra ngoài khung
                  cropShape="rect" // Hình dạng khung crop: 'rect' (chữ nhật) hoặc 'round' (tròn)
                  showGrid={true}
                  classes={{
                    containerClassName: 'bg-black',
                    mediaClassName: 'object-contain'
                  }}
                />
              )}
            </div>
            
            {/* Zoom Controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full text-white shadow-lg">
                <SearchMinus className="w-5 h-5 opacity-70" />
                <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e) => {
                        setZoom(Number(e.target.value))
                    }}
                    className="w-40 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer range-sm accent-emerald-400"
                />
                <SearchPlus className="w-5 h-5 opacity-70" />
            </div>

            <div className="text-center text-white mt-16"> {/* Adjust margin-top if zoom controls overlap */}
              <h3 className="text-2xl font-black tracking-tight mb-2">Điều chỉnh đề bài</h3>
              <p className="text-slate-400 text-sm font-medium">Kéo ảnh và phóng to/thu nhỏ để chọn vùng chính xác</p>
            </div>
          </div>

          <div className="flex gap-4 max-w-md mx-auto w-full pb-10 mt-auto"> {/* mt-auto để đẩy xuống dưới */}
            <button 
              onClick={handleRetry} 
              className="flex-1 py-5 bg-white/10 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:bg-white/20 transition-all border border-white/5"
            >
              <RotateCcw className="w-5 h-5" />
              Chụp lại
            </button>
            <button 
              onClick={handleConfirm} 
              className="flex-[1.5] py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:scale-105 shadow-2xl shadow-indigo-500/30 transition-all"
            >
              <Check className="w-6 h-6" />
              Gửi AI
            </button>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; }
          50% { top: 100%; }
        }
        /* Tùy chỉnh thanh range cho đẹp hơn */
        input[type=range]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #34d399; /* emerald-400 */
            cursor: pointer;
            box-shadow: 0 0 0 4px rgba(255,255,255,0.2);
        }
        input[type=range]::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            background: #34d399; /* emerald-400 */
            cursor: pointer;
            box-shadow: 0 0 0 4px rgba(255,255,255,0.2);
        }
      `}</style>
    </div>
  );
};

export default CameraScanner;
