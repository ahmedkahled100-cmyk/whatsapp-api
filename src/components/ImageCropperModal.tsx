'use client';

import { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, ZoomIn, RotateCw } from 'lucide-react';
import getCroppedImg from '@/lib/crop-utils';

interface ImageCropperModalProps {
  image: string;
  aspect?: number;
  onCropComplete: (croppedImage: Blob) => void;
  onCancel: () => void;
  circular?: boolean;
}

export default function ImageCropperModal({ 
  image, 
  aspect = 1, 
  onCropComplete, 
  onCancel,
  circular = false
}: ImageCropperModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const onCropChange = (crop: { x: number; y: number }) => {
    setCrop(crop);
  };

  const onZoomChange = (zoom: number) => {
    setZoom(zoom);
  };

  const onCropAreaComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setLoading(true);
    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
      if (croppedImage) {
        onCropComplete(croppedImage);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300 p-4">
      <div className="card-base w-full max-w-2xl overflow-hidden flex flex-col h-[85vh] sm:h-[70vh] shadow-2xl border-white/10">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gold/20 flex items-center justify-center">
              <Check size={18} className="text-gold" />
            </div>
            <div>
              <h3 className="font-bold text-white">تعديل الصورة</h3>
              <p className="text-[10px] text-gray-400">قم بقص الصورة لتناسب الملف الشخصي بك</p>
            </div>
          </div>
          <button 
            onClick={onCancel}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Cropper Container */}
        <div className="relative flex-1 bg-black/40 overflow-hidden">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={aspect}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onRotationChange={setRotation}
            onCropComplete={onCropAreaComplete}
            cropShape={circular ? 'round' : 'rect'}
            showGrid={true}
            style={{
              containerStyle: { background: 'transparent' },
              cropAreaStyle: { border: '2px solid var(--gold)' }
            }}
          />
        </div>

        {/* Controls */}
        <div className="p-5 bg-white/5 border-t border-white/10 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Zoom Slider */}
            <div className="flex-1 w-full flex items-center gap-3">
              <ZoomIn size={18} className="text-gray-400" />
              <input
                type="range"
                min={1}
                max={3}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-gold h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400 font-mono w-8">{Math.round(zoom * 100)}%</span>
            </div>

            {/* Rotation Slider */}
            <div className="flex-1 w-full flex items-center gap-3">
              <RotateCw size={18} className="text-gray-400" />
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                className="flex-1 accent-purple-500 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer"
              />
              <span className="text-xs text-gray-400 font-mono w-8">{rotation}°</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="btn-outline flex-1 py-3 font-bold"
              disabled={loading}
            >
              إلغاء
            </button>
            <button
              onClick={handleSave}
              className="btn-gold flex-1 py-3 font-bold shadow-lg shadow-gold/20"
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-dark border-t-transparent rounded-full animate-spin" />
                  <span>جاري المعالجة...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Check size={18} />
                  <span>حفظ القص</span>
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
