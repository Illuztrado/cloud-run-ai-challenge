import React, { useState, useRef, useEffect } from 'react';
import {
  Car,
  UploadCloud,
  Sparkles,
  Send,
  Save,
  Share2,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  FileText,
  DollarSign,
  Image as ImageIcon,
  RotateCcw,
  MessageSquare,
  HelpCircle,
  ChevronRight,
  Shield,
  Trash2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { RideEntry, RideHailingApp, ChatMessage, CommunityRide } from '../types';
import { saveRideEntry, publishCommunityRide } from '../lib/firebase';

interface RideWorkspaceProps {
  user: User;
  ride: RideEntry;
  onUpdateRide: (updated: Partial<RideEntry>) => void;
  onSaveToHistory: (ride: RideEntry) => Promise<void>;
  onPublishToCommunity: (ride: CommunityRide) => Promise<void>;
  onDeleteRide?: (rideId: string) => Promise<void>;
}

const APP_COLORS: Record<RideHailingApp, { bg: string; text: string; border: string; label: string }> = {
  Grab: { bg: 'bg-emerald-950/60', text: 'text-emerald-400', border: 'border-emerald-700/60', label: 'GrabCar / GrabTaxi' },
  Angkas: { bg: 'bg-blue-950/60', text: 'text-blue-400', border: 'border-blue-700/60', label: 'Angkas Moto Taxi' },
  JoyRide: { bg: 'bg-cyan-950/60', text: 'text-cyan-400', border: 'border-cyan-700/60', label: 'JoyRide MC / Car' },
  'Move It': { bg: 'bg-rose-950/60', text: 'text-rose-400', border: 'border-rose-700/60', label: 'Move It' },
  InDrive: { bg: 'bg-teal-950/60', text: 'text-teal-400', border: 'border-teal-700/60', label: 'InDrive Bidding' },
  Taxi: { bg: 'bg-amber-950/60', text: 'text-amber-400', border: 'border-amber-700/60', label: 'Metered Taxi' },
  Other: { bg: 'bg-neutral-800', text: 'text-neutral-300', border: 'border-neutral-700', label: 'Other Service' },
};

export const RideWorkspace: React.FC<RideWorkspaceProps> = ({
  user,
  ride,
  onUpdateRide,
  onSaveToHistory,
  onPublishToCommunity,
  onDeleteRide,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [mobileTab, setMobileTab] = useState<'form' | 'chat'>('form');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ride.messages]);

  // Handle Image Upload & Gemini Extraction
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please upload a valid receipt or screenshot image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const base64Data = dataUrl.split(',')[1];
      const mimeType = file.type || 'image/jpeg';

      onUpdateRide({ receiptImage: dataUrl });
      await triggerGeminiExtraction(base64Data, mimeType);
    };
    reader.readAsDataURL(file);
  };

  const triggerGeminiExtraction = async (base64Data?: string, mimeType: string = 'image/jpeg') => {
    setIsScanning(true);
    setErrorMessage(null);

    const imageToUse = base64Data || (ride.receiptImage ? ride.receiptImage.split(',')[1] : undefined);

    try {
      const response = await fetch('/api/ride/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageToUse,
          mimeType,
          textInput: `Service: ${ride.rideService || ''}. Fare: ${ride.farePaid || ''}. From: ${ride.pickupAddress || ''} To: ${ride.destinationAddress || ''}. Notes: ${ride.reviewText || ''}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Receipt extraction failed. Please check server logs.');
      }

      const extracted = await response.json();

      // Ensure reviewText defaults to "None" if empty
      const finalReview = extracted.reviewText && extracted.reviewText.trim() ? extracted.reviewText : 'None';

      const initialAiMessage: ChatMessage = {
        role: 'model',
        content: extracted.aiResponse || `I have extracted the ride information: ₱${extracted.farePaid} on ${extracted.rideService} from ${extracted.pickupAddress} to ${extracted.destinationAddress}. How can I assist you further with this ride?`,
        timestamp: new Date().toISOString(),
      };

      const updatedMessages = [...(ride.messages || []), initialAiMessage];

      const extractedService = (extracted.rideService as RideHailingApp) || ride.rideService || 'Grab';
      const extractedCategory = extracted.vehicleCategory || (['Angkas', 'Move It'].includes(extractedService) ? '2-wheel' : '4-wheel');

      onUpdateRide({
        rideService: extractedService,
        vehicleType: extractedCategory,
        farePaid: Number(extracted.farePaid) || ride.farePaid || 0,
        pickupAddress: extracted.pickupAddress || ride.pickupAddress || '',
        destinationAddress: extracted.destinationAddress || ride.destinationAddress || '',
        tripDuration: extracted.tripDuration || ride.tripDuration || '',
        tripDistance: extracted.tripDistance || ride.tripDistance || '',
        reviewText: finalReview,
        messages: updatedMessages,
      });

      // Save immediately to isolated user Firestore
      setSaveStatus('saving');
      await onSaveToHistory({
        ...ride,
        rideService: extractedService,
        vehicleType: extractedCategory,
        farePaid: Number(extracted.farePaid) || ride.farePaid || 0,
        pickupAddress: extracted.pickupAddress || ride.pickupAddress || '',
        destinationAddress: extracted.destinationAddress || ride.destinationAddress || '',
        tripDuration: extracted.tripDuration || ride.tripDuration || '',
        tripDistance: extracted.tripDistance || ride.tripDistance || '',
        reviewText: finalReview,
        messages: updatedMessages,
      });
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Scan error:', err);
      setErrorMessage(err.message || 'Failed to scan receipt image.');
      setSaveStatus('error');
    } finally {
      setIsScanning(false);
    }
  };

  // Handle Multi-Turn Chat with Gemini
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || chatInput).trim();
    if (!text || isSendingChat) return;

    setChatInput('');
    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    const newMessages = [...(ride.messages || []), userMsg];
    onUpdateRide({ messages: newMessages });

    setIsSendingChat(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/ride/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          rideContext: {
            rideService: ride.rideService,
            farePaid: ride.farePaid,
            pickupAddress: ride.pickupAddress,
            destinationAddress: ride.destinationAddress,
            tripDuration: ride.tripDuration,
            reviewText: ride.reviewText,
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to receive response from Gemini advisor.');
      }

      const data = await response.json();
      const modelMsg: ChatMessage = {
        role: 'model',
        content: data.text || 'I analyzed your ride details. Feel free to ask more questions about fare rates or alternatives!',
        timestamp: new Date().toISOString(),
      };

      const finalMessages = [...newMessages, modelMsg];
      const updates: Partial<RideEntry> = { messages: finalMessages };

      // If Gemini parsed or updated ride transaction attributes from user's conversation
      if (data.extractedRide) {
        if (data.extractedRide.rideService) updates.rideService = data.extractedRide.rideService;
        if (data.extractedRide.vehicleType) updates.vehicleType = data.extractedRide.vehicleType;
        if (data.extractedRide.farePaid !== undefined && data.extractedRide.farePaid > 0) {
          updates.farePaid = Number(data.extractedRide.farePaid);
        }
        if (data.extractedRide.pickupAddress) updates.pickupAddress = data.extractedRide.pickupAddress;
        if (data.extractedRide.destinationAddress) updates.destinationAddress = data.extractedRide.destinationAddress;
        if (data.extractedRide.tripDuration) updates.tripDuration = data.extractedRide.tripDuration;
        if (data.extractedRide.tripDistance) updates.tripDistance = data.extractedRide.tripDistance;
        if (data.extractedRide.reviewText) updates.reviewText = data.extractedRide.reviewText;
      }

      onUpdateRide(updates);

      // Automatically persist interaction to isolated user collection
      await onSaveToHistory({
        ...ride,
        ...updates,
      });
      setSaveStatus('saved');
    } catch (err: any) {
      console.error('Chat error:', err);
      setErrorMessage(err.message || 'Failed to converse with Gemini.');
    } finally {
      setIsSendingChat(false);
    }
  };

  // Handle Manual Save to Private History
  const handleManualSave = async () => {
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const cleanRide: RideEntry = {
        ...ride,
        reviewText: ride.reviewText && ride.reviewText.trim() ? ride.reviewText : 'None',
      };
      await onSaveToHistory(cleanRide);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMessage(err.message || 'Failed to save to Firestore.');
      setSaveStatus('error');
    }
  };

  // Handle Publishing to General Community Board
  const handlePublishToCommunity = async () => {
    if (!ride.farePaid || Number(ride.farePaid) <= 0) {
      setErrorMessage('Please enter a valid fare before publishing to the community board.');
      return;
    }

    setIsPublishing(true);
    setErrorMessage(null);
    try {
      const defaultVehicleType = ['Angkas', 'Move It'].includes(ride.rideService) ? '2-wheel' : '4-wheel';
      const communityRecord: CommunityRide = {
        id: ride.id,
        userId: user.uid,
        userDisplayName: user.displayName || 'Commuter Community',
        userPhotoURL: user.photoURL,
        rideService: ride.rideService || 'Grab',
        vehicleType: ride.vehicleType || defaultVehicleType,
        farePaid: Number(ride.farePaid),
        pickupAddress: ride.pickupAddress || 'Metro Manila',
        destinationAddress: ride.destinationAddress || 'Metro Manila',
        tripDuration: ride.tripDuration || '',
        tripDistance: ride.tripDistance || '',
        reviewText: ride.reviewText && ride.reviewText.trim() ? ride.reviewText : 'None',
        hasReceipt: Boolean(ride.receiptImage),
        createdAt: ride.createdAt || new Date().toISOString(),
      };

      await onPublishToCommunity(communityRecord);
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 4000);
    } catch (err: any) {
      console.error('Publish error:', err);
      setErrorMessage(err.message || 'Failed to publish to community board.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-neutral-950 text-neutral-100">
      {/* Top Action Bar */}
      <div className="min-h-[56px] px-3 sm:px-6 border-b border-neutral-800/80 bg-neutral-900/40 flex items-center justify-between flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`px-2 py-1 rounded-md text-xs font-semibold border truncate ${APP_COLORS[ride.rideService || 'Grab'].bg} ${APP_COLORS[ride.rideService || 'Grab'].text} ${APP_COLORS[ride.rideService || 'Grab'].border}`}>
            {ride.rideService || 'Grab'}
          </span>
          <span className="text-sm font-bold text-neutral-100 flex-shrink-0">
            {ride.farePaid ? `₱${ride.farePaid}` : 'Unstated'}
          </span>
          {ride.pickupAddress && ride.destinationAddress && (
            <span className="text-xs text-neutral-400 hidden xl:inline truncate max-w-xs">
              • {ride.pickupAddress} → {ride.destinationAddress}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {saveStatus === 'saving' && (
            <span className="text-xs text-amber-400 hidden sm:flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 animate-spin" /> Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-emerald-400 hidden sm:flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Saved
            </span>
          )}

          <button
            id="publish-community-button"
            onClick={handlePublishToCommunity}
            disabled={isPublishing}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-600/40 text-xs font-medium transition min-h-[44px] active:scale-95"
            title="Publish transaction to the general community board"
          >
            {isPublishing ? (
              <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Share to Community</span>
            <span className="sm:hidden">Share</span>
          </button>

          <button
            id="save-ride-button"
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold transition active:scale-95 min-h-[44px] shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Mobile-First Segmented View Switcher (< lg) */}
      <div className="lg:hidden p-2 bg-neutral-900/90 border-b border-neutral-800 flex items-center gap-2 sticky top-0 z-20">
        <button
          id="mobile-tab-form-btn"
          onClick={() => setMobileTab('form')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition min-h-[44px] active:scale-98 ${
            mobileTab === 'form'
              ? 'bg-amber-400 text-neutral-950 shadow-md'
              : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-neutral-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Ride & Receipt</span>
        </button>

        <button
          id="mobile-tab-chat-btn"
          onClick={() => setMobileTab('chat')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition min-h-[44px] active:scale-98 relative ${
            mobileTab === 'chat'
              ? 'bg-amber-400 text-neutral-950 shadow-md'
              : 'bg-neutral-950 text-neutral-400 border border-neutral-800 hover:text-neutral-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Advisor</span>
          {ride.messages && ride.messages.length > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold ${
              mobileTab === 'chat' ? 'bg-neutral-950 text-amber-300' : 'bg-neutral-800 text-neutral-300'
            }`}>
              {ride.messages.length}
            </span>
          )}
        </button>
      </div>

      {/* Error & Success Toasts */}
      {errorMessage && (
        <div className="mx-3 sm:mx-6 mt-3 p-3 bg-red-950/70 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => handleManualSave()}
            className="px-3 py-1.5 rounded-lg bg-red-900/80 hover:bg-red-800 text-red-100 text-[11px] font-medium min-h-[36px]"
          >
            Retry Save
          </button>
        </div>
      )}

      {publishSuccess && (
        <div className="mx-3 sm:mx-6 mt-3 p-3 bg-emerald-950/70 border border-emerald-800/80 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>Trip published to Community Board! Fellow commuters can now view and compare this fare.</span>
        </div>
      )}

      {/* Main Two-Column Layout (Stacked with Tabs on Mobile, Side-by-Side on Desktop) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left Column: Form & Receipt Image Upload (5 cols on lg) */}
        <div className={`${mobileTab === 'form' ? 'block' : 'hidden'} lg:block lg:col-span-5 p-3.5 sm:p-5 border-r border-neutral-800/80 overflow-y-auto space-y-4 sm:space-y-5 bg-neutral-900/20`}>
          {/* Receipt Upload / Scanner Card */}
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                Receipt Screenshot
              </span>
              {ride.receiptImage && (
                <button
                  onClick={() => triggerGeminiExtraction()}
                  disabled={isScanning}
                  className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium min-h-[36px] px-2 py-1 rounded-lg hover:bg-neutral-800"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Re-scan with Gemini</span>
                </button>
              )}
            </div>

            {ride.receiptImage ? (
              <div className="relative rounded-xl overflow-hidden border border-neutral-700 max-h-52 group">
                <img
                  src={ride.receiptImage}
                  alt="Receipt Preview"
                  className="w-full h-44 sm:h-48 object-cover"
                />
                <div className="absolute inset-0 bg-neutral-950/75 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 p-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-neutral-800 text-xs font-semibold text-white hover:bg-neutral-700 active:scale-95 transition"
                  >
                    Change Image
                  </button>
                  <button
                    onClick={() => onUpdateRide({ receiptImage: '' })}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-red-900/80 text-xs font-semibold text-red-200 hover:bg-red-800 active:scale-95 transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]);
                }}
                className="border-2 border-dashed border-neutral-700 hover:border-amber-500/50 rounded-xl p-5 sm:p-6 text-center cursor-pointer transition bg-neutral-950/40 group active:bg-neutral-900"
              >
                <div className="w-11 h-11 rounded-xl bg-neutral-800 text-amber-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-xs sm:text-sm font-semibold text-neutral-200 mb-1">
                  Tap to upload or take receipt photo
                </p>
                <p className="text-[11px] text-neutral-400">
                  Grab, Angkas, JoyRide, Move It, InDrive (PNG/JPG)
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleImageFile(e.target.files[0]);
              }}
            />

            {isScanning && (
              <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2 animate-pulse">
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin flex-shrink-0" />
                <span>Gemini is extracting fare, addresses, and trip metrics from your receipt...</span>
              </div>
            )}
          </div>

          {/* Ride Details Form */}
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-4">
            <h3 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-400" />
              Ride Information
            </h3>

            {/* Ride Service Selector */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Ride-Hailing Platform <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                {(['Grab', 'Angkas', 'JoyRide', 'Move It', 'InDrive', 'Taxi'] as RideHailingApp[]).map((service) => (
                  <button
                    key={service}
                    type="button"
                    onClick={() => {
                      const isMoto = ['Angkas', 'Move It'].includes(service);
                      onUpdateRide({ 
                        rideService: service,
                        vehicleType: isMoto ? '2-wheel' : '4-wheel'
                      });
                    }}
                    className={`min-h-[44px] px-2.5 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center transition active:scale-95 ${
                      ride.rideService === service
                        ? `${APP_COLORS[service].bg} ${APP_COLORS[service].text} ${APP_COLORS[service].border} ring-1 ring-amber-400/50 shadow-sm`
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    {service}
                  </button>
                ))}
              </div>
            </div>

            {/* Vehicle Type (4-wheel vs 2-wheel) */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Vehicle Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUpdateRide({ vehicleType: '4-wheel' })}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition active:scale-95 ${
                    ride.vehicleType === '4-wheel' || (!ride.vehicleType && !['Angkas', 'Move It'].includes(ride.rideService || 'Grab'))
                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 ring-1 ring-amber-400/30'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <span>🚗 4-Wheel (Car/Taxi)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateRide({ vehicleType: '2-wheel' })}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition active:scale-95 ${
                    ride.vehicleType === '2-wheel' || (!ride.vehicleType && ['Angkas', 'Move It'].includes(ride.rideService || 'Grab'))
                      ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 ring-1 ring-amber-400/30'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <span>🏍️ 2-Wheel (Moto Taxi)</span>
                </button>
              </div>
            </div>

            {/* Fare Paid (PHP) */}
            <div>
              <label className="block text-xs font-medium text-neutral-300 mb-1">
                Fare Paid (₱ PHP) <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-neutral-400 text-sm font-bold">₱</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={ride.farePaid || ''}
                  onChange={(e) => onUpdateRide({ farePaid: parseFloat(e.target.value) || 0 })}
                  placeholder="e.g., 320"
                  className="w-full min-h-[44px] pl-9 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-base sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Pickup & Destination Addresses */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Pick Up Landmark / Barangay <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-emerald-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={ride.pickupAddress || ''}
                    onChange={(e) => onUpdateRide({ pickupAddress: e.target.value })}
                    placeholder="e.g., SM Megamall, Mandaluyong City"
                    className="w-full min-h-[44px] pl-10 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-base sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Destination Landmark / Barangay <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-rose-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={ride.destinationAddress || ''}
                    onChange={(e) => onUpdateRide({ destinationAddress: e.target.value })}
                    placeholder="e.g., Bonifacio High Street, BGC, Taguig"
                    className="w-full min-h-[44px] pl-10 pr-3 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-base sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Trip Duration & Distance (Optional) */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Duration (Optional)
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={ride.tripDuration || ''}
                    onChange={(e) => onUpdateRide({ tripDuration: e.target.value })}
                    placeholder="e.g., 28 mins"
                    className="w-full min-h-[44px] pl-10 pr-2 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-base sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">
                  Distance (Optional)
                </label>
                <input
                  type="text"
                  value={ride.tripDistance || ''}
                  onChange={(e) => onUpdateRide({ tripDistance: e.target.value })}
                  placeholder="e.g., 5.8 km"
                  className="w-full min-h-[44px] px-3 py-2 bg-neutral-950 border border-neutral-700 rounded-xl text-base sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Reviews / Feedback on the trip (Default response is "None") */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-neutral-300">
                  Reviews & Feedback on the Trip
                </label>
                <span className="text-[10px] text-neutral-400 font-mono">Default: None</span>
              </div>
              <textarea
                rows={3}
                value={ride.reviewText ?? 'None'}
                onChange={(e) => onUpdateRide({ reviewText: e.target.value })}
                placeholder="Rider review (or leave as None)"
                className="w-full p-3 bg-neutral-950 border border-neutral-700 rounded-xl text-base sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Mobile Callout to Switch to Chat */}
            <div className="pt-2 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileTab('chat')}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-neutral-950 text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-98 transition"
              >
                <Sparkles className="w-4 h-4 text-neutral-950" />
                <span>Consult Gemini Commuter Advisor →</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Multi-Turn Gemini Commuter Conversation (7 cols on lg) */}
        <div className={`${mobileTab === 'chat' ? 'flex' : 'hidden'} lg:flex lg:col-span-7 flex-col h-full bg-neutral-950`}>
          {/* Chat Header */}
          <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/30">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-neutral-200">Gemini Commuter Advisor</h4>
                <p className="text-[10px] text-neutral-400">
                  Fare benchmarks, surge analysis & commuter tips
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileTab('form')}
                className="lg:hidden text-xs text-amber-400 px-2 py-1 rounded-lg border border-amber-400/30 bg-amber-400/10 font-medium"
              >
                Edit Trip
              </button>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 font-mono hidden sm:inline">
                Multi-Turn
              </span>
            </div>
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-3 sm:px-4 py-2 border-b border-neutral-800/60 bg-neutral-900/10 flex items-center gap-1.5 overflow-x-auto text-[11px] whitespace-nowrap scrollbar-none">
            <span className="text-neutral-500 font-medium mr-1 flex-shrink-0">Ask:</span>
            <button
              onClick={() => handleSendMessage('Is this fare reasonable for this route during typical traffic?')}
              className="min-h-[36px] px-3 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition active:scale-95 flex-shrink-0"
            >
              Is this fare reasonable?
            </button>
            <button
              onClick={() => handleSendMessage('How would this fare compare to Angkas, JoyRide, or Move It?')}
              className="min-h-[36px] px-3 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition active:scale-95 flex-shrink-0"
            >
              Compare with Motorcycle Taxis
            </button>
            <button
              onClick={() => handleSendMessage('Why is there high surge pricing on this route and when does it drop?')}
              className="min-h-[36px] px-3 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition active:scale-95 flex-shrink-0"
            >
              Surge times & drops
            </button>
            <button
              onClick={() => handleSendMessage('What are alternative commuting routes to avoid EDSA / C5 traffic?')}
              className="min-h-[36px] px-3 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 transition active:scale-95 flex-shrink-0"
            >
              Alternative routes
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 p-3.5 sm:p-5 overflow-y-auto space-y-4">
            {(!ride.messages || ride.messages.length === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-sm mx-auto text-neutral-400">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-neutral-200 mb-1">
                  Start Your Trip Analysis
                </h4>
                <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                  Upload a receipt screenshot or enter your ride details. Gemini will analyze whether your fare was inflated by surge, compare platforms, and provide commuter tips.
                </p>
                <button
                  onClick={() => handleSendMessage('Please review my ride fare and provide pricing insights.')}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold shadow-sm transition active:scale-95"
                >
                  Analyze My Ride Now
                </button>
              </div>
            ) : (
              ride.messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[85%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-amber-500 text-neutral-950 font-medium rounded-tr-none shadow-sm'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-tl-none'
                    }`}
                  >
                    {m.role === 'model' ? (
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    ) : (
                      <div>{m.content}</div>
                    )}
                  </div>
                  <span className="text-[10px] text-neutral-500 mt-1 px-1">
                    {m.role === 'user' ? 'You' : 'Gemini Advisor'}
                  </span>
                </div>
              ))
            )}

            {isSendingChat && (
              <div className="flex flex-col items-start">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl rounded-tl-none p-3.5 text-xs text-neutral-300 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse delay-150" />
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse delay-300" />
                  <span className="ml-1 text-neutral-400">Gemini is analyzing fare dynamics...</span>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-3 sm:p-4 border-t border-neutral-800 bg-neutral-900/30">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Gemini about this fare, write a review, or inquire..."
                className="flex-1 min-h-[48px] px-4 py-2.5 bg-neutral-950 border border-neutral-700 rounded-xl text-base sm:text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isSendingChat}
                className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
