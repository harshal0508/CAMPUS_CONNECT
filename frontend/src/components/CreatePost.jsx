import { useState, useRef, useEffect } from 'react';
import { Image, Smile, Calendar, MapPin, X, Loader2 } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import API from '../api/axios';

export default function CreatePost({ onPostCreated, user }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    }

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text && !image) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('text', text); 
    
    if (image) formData.append('media', image);
    
    if (location) {
      formData.append('location', JSON.stringify(location));
    }

    try {
      const { data } = await API.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onPostCreated(data);
      setText('');
      setImage(null);
      setPreview(null);
      setLocation(null);
    } catch (err) {
      console.error("Post creation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const onEmojiClick = (emojiObject) => {
    setText(text + emojiObject.emoji);
  };

  const addDate = () => {
    const today = new Date().toLocaleDateString();
    setText(text + ` 📅 ${today}`);
  };

  const addLocation = async () => {
    setLocationLoading(true);

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          
          const city = data.address.city || data.address.town || data.address.village || '';
          const state = data.address.state || '';
          const country = data.address.country || '';
          
          let locationString = '';
          if (city && state) {
            locationString = `${city}, ${state}`;
          } else if (city) {
            locationString = city;
          } else if (state) {
            locationString = `${state}, ${country}`;
          } else {
            locationString = country;
          }
          
          setLocation({
            latitude,
            longitude,
            name: locationString,
            full: data.display_name
          });
          
          setText(text + ` 📍 ${locationString}`);
          
        } catch (error) {
          console.error('Error getting location name:', error);
          setText(text + ` 📍 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          setLocation({
            latitude,
            longitude,
            name: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
          });
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setLocationLoading(false);
        
        switch(error.code) {
          case error.PERMISSION_DENIED:
            alert('Location permission denied. Please enable location access in your browser settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            alert('Location information is unavailable.');
            break;
          case error.TIMEOUT:
            alert('Location request timed out.');
            break;
          default:
            alert('An unknown error occurred while getting location.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="p-6 flex gap-4 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
      <div className="w-10 h-10 flex-shrink-0 mt-1 cursor-pointer transition-transform active:scale-95">
        <div className="w-full h-full rounded-full bg-gradient-to-br from-[#1d9bf0] to-purple-500 p-[2px]">
          <img 
            src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.name || 'U'}`}
            alt={user?.name || 'User'}
            className="w-full h-full rounded-full object-cover border-2 border-white dark:border-gray-900 bg-gray-100 dark:bg-gray-800"
          />
        </div>
      </div>
      
      <div className="flex-1">
        <form onSubmit={handleSubmit}>
          <textarea
            className="w-full bg-transparent border-none text-[20px] outline-none resize-none placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-gray-100 min-h-[50px] pt-1"
            placeholder="What's happening in Campus?"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
          />
          
          {location && (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
              <MapPin size={16} className="text-[#1d9bf0]" />
              <span>{location.name}</span>
              <button
                type="button"
                onClick={() => setLocation(null)}
                className="ml-auto text-gray-400 hover:text-red-500 transition"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {preview && (
            <div className="relative mb-3 mt-2">
              <button 
                type="button"
                onClick={() => { setImage(null); setPreview(null); }}
                className="absolute top-2 left-2 bg-black/70 p-1.5 rounded-full hover:bg-black/90 transition backdrop-blur-sm"
              >
                <X size={18} className="text-white" />
              </button>
              <img src={preview} alt="Preview" className="rounded-2xl w-full max-h-[500px] object-cover border border-gray-300 dark:border-gray-700" />
            </div>
          )}
          
          <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-300 dark:border-gray-700 relative">
            <div className="flex text-[#1d9bf0] relative">
              {/* Image Button */}
              <button 
                type="button" 
                onClick={() => fileInputRef.current.click()} 
                className="p-2 hover:bg-[#1d9bf0]/10 rounded-full transition"
                title="Add image"
              >
                <Image size={20} />
              </button>

              {/* Emoji Picker Button */}
              <div className="relative" ref={emojiPickerRef}>
                <button 
                  type="button" 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2 hover:bg-[#1d9bf0]/10 rounded-full transition hidden sm:block"
                  title="Add emoji"
                >
                  <Smile size={20} />
                </button>
                
                {/* Full Emoji Picker - CHANGED: top-full instead of bottom-full */}
                {showEmojiPicker && (
                  <div className="absolute top-full left-0 mt-2 z-50">
                    <EmojiPicker 
                      onEmojiClick={onEmojiClick}
                      theme="auto"
                      width={350}
                      height={450}
                      searchPlaceHolder="Search emoji..."
                      previewConfig={{
                        showPreview: false
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Calendar Button */}
              <button 
                type="button" 
                onClick={addDate}
                className="p-2 hover:bg-[#1d9bf0]/10 rounded-full transition hidden sm:block"
                title="Add date"
              >
                <Calendar size={20} />
              </button>

              {/* Location Button */}
              <button 
                type="button" 
                onClick={addLocation}
                disabled={locationLoading}
                className="p-2 hover:bg-[#1d9bf0]/10 rounded-full transition hidden sm:block disabled:opacity-50"
                title="Add location"
              >
                {locationLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <MapPin size={20} />
                )}
              </button>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) { setImage(file); setPreview(URL.createObjectURL(file)); }
                }} 
                className="hidden" 
                accept="image/*" 
              />
            </div>

            <button
              type="submit"
              disabled={loading || (!text && !image)}
              className="bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-bold px-5 py-1.5 rounded-full transition disabled:opacity-50"
            >
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}