import React, { useState, useEffect } from 'react';
import { X, Download, RotateCcw, Info, AlertCircle } from 'lucide-react';
import { UpdateInfo, UpdateProgress } from '../../types/electron-api';

interface UpdateNotificationProps {
  onClose?: () => void;
  showOnConnectionsOnly?: boolean;
  currentView?: string;
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';

export const UpdateNotification: React.FC<UpdateNotificationProps> = ({ 
  onClose, 
  showOnConnectionsOnly = true, 
  currentView = 'connections' 
}) => {
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<UpdateProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const electronAPI = window.electronAPI;
    if (!electronAPI?.updater) return;

    // Obtenir la version actuelle
    electronAPI.updater.getVersion().then(result => {
      if (result.success && result.version) {
        setCurrentVersion(result.version);
      }
    });

    // Écouter les événements d'update
    electronAPI.updater.onUpdateAvailable((info: UpdateInfo) => {
      console.log('Update available:', info);
      setUpdateState('available');
      setUpdateInfo(info);
      setIsVisible(true);
    });

    electronAPI.updater.onUpdateDownloaded((info: UpdateInfo) => {
      console.log('Update downloaded:', info);
      setUpdateState('downloaded');
      setUpdateInfo(info);
      setDownloadProgress(null);
    });

    electronAPI.updater.onUpdateProgress((progress: UpdateProgress) => {
      console.log('Update progress:', progress);
      setUpdateState('downloading');
      setDownloadProgress(progress);
    });

    electronAPI.updater.onUpdateError((errorMsg: string) => {
      console.error('Update error:', errorMsg);
      setUpdateState('error');
      setError(errorMsg);
      setIsVisible(true);
    });

    return () => {
      electronAPI.updater.removeUpdateListeners();
    };
  }, []);

  const handleCheckForUpdates = async () => {
    const electronAPI = window.electronAPI;
    if (!electronAPI?.updater) return;

    setUpdateState('checking');
    setError(null);
    setIsVisible(true);

    try {
      const result = await electronAPI.updater.checkForUpdates();
      if (result.success) {
        if (result.updateInfo) {
          setUpdateState('available');
          setUpdateInfo(result.updateInfo);
        } else {
          setUpdateState('idle');
          setTimeout(() => setIsVisible(false), 3000);
        }
      } else {
        setUpdateState('error');
        setError(result.error || 'Unknown error');
      }
    } catch (err) {
      setUpdateState('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDownloadUpdate = async () => {
    const electronAPI = window.electronAPI;
    if (!electronAPI?.updater) return;

    setUpdateState('downloading');
    try {
      const result = await electronAPI.updater.downloadAndInstall();
      if (!result.success) {
        setUpdateState('error');
        setError(result.error || 'Download failed');
      }
    } catch (err) {
      setUpdateState('error');
      setError(err instanceof Error ? err.message : 'Download failed');
    }
  };

  const handleRestartAndInstall = async () => {
    const electronAPI = window.electronAPI;
    if (!electronAPI?.updater) return;

    try {
      await electronAPI.updater.restartAndInstall();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restart failed');
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  // Ne pas afficher si on n'est pas sur la page des connexions
  if (showOnConnectionsOnly && currentView !== 'connections') {
    return null;
  }

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={handleCheckForUpdates}
          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-colors"
          title="Check for updates"
        >
          <Download size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-xl max-w-sm w-full">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {updateState === 'error' ? (
              <AlertCircle className="text-red-500" size={20} />
            ) : (
              <Info className="text-blue-500" size={20} />
            )}
            <h3 className="font-semibold text-gray-900">
              {updateState === 'checking' && 'Checking for updates...'}
              {updateState === 'available' && 'Update available'}
              {updateState === 'downloading' && 'Downloading update...'}
              {updateState === 'downloaded' && 'Update ready'}
              {updateState === 'error' && 'Update error'}
              {updateState === 'idle' && 'Up to date'}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {currentVersion && (
          <p className="text-sm text-gray-600 mb-2">
            Current version: {currentVersion}
          </p>
        )}

        {updateInfo && (
          <p className="text-sm text-gray-600 mb-3">
            Version {updateInfo.version} is available
            {updateInfo.releaseName && ` (${updateInfo.releaseName})`}
          </p>
        )}

        {downloadProgress && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>{downloadProgress.percent.toFixed(1)}%</span>
              <span>{formatSpeed(downloadProgress.bytesPerSecond)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <div className="text-xs text-gray-600 mt-1">
              {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 mb-3">{error}</p>
        )}

        {updateState === 'idle' && (
          <p className="text-sm text-green-600 mb-3">
            You're running the latest version
          </p>
        )}

        <div className="flex gap-2">
          {updateState === 'checking' && (
            <button
              disabled
              className="flex-1 bg-gray-100 text-gray-400 px-3 py-2 rounded text-sm"
            >
              Checking...
            </button>
          )}

          {updateState === 'available' && (
            <button
              onClick={handleDownloadUpdate}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
            >
              Download
            </button>
          )}

          {updateState === 'downloading' && (
            <button
              disabled
              className="flex-1 bg-gray-100 text-gray-400 px-3 py-2 rounded text-sm"
            >
              Downloading...
            </button>
          )}

          {updateState === 'downloaded' && (
            <button
              onClick={handleRestartAndInstall}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={14} />
              Restart & Install
            </button>
          )}

          {(updateState === 'error' || updateState === 'idle') && (
            <button
              onClick={handleCheckForUpdates}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors"
            >
              Check Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};