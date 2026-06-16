import { useState, useCallback } from 'react';
import { useProfileStore } from '@/stores/profileStore';
import { useLocale } from '@/hooks/useTheme';
import { exportAllData, importData, getStorageSize, clearAllData } from '@/utils/dataExport';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { ImportResult } from '@/types/profile';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function Profile() {
  const {
    deviceId,
    displayName,
    avatarSeed,
    createdAt,
    updateDisplayName,
    regenerateAvatar,
  } = useProfileStore();

  const locale = useLocale();

  const [nameInput, setNameInput] = useState(displayName);
  const [nameSaved, setNameSaved] = useState(false);
  const [storageSize, setStorageSize] = useState<{ indexedDB: number; localStorage: number } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const handleSaveName = useCallback(() => {
    updateDisplayName(nameInput);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  }, [nameInput, updateDisplayName]);

  const handleRefreshStorage = useCallback(async () => {
    const size = await getStorageSize();
    setStorageSize(size);
  }, []);

  const handleExport = useCallback(async () => {
    const json = await exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `AimPad_backup_${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const result = await importData(text);
      setImportResult(result);
      setTimeout(() => setImportResult(null), 5000);
    };
    input.click();
  }, []);

  const handleClearAll = useCallback(async () => {
    await clearAllData();
    setShowClearConfirm(false);
    window.location.reload();
  }, []);

  const handleCopyId = useCallback(() => {
    navigator.clipboard.writeText(deviceId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  }, [deviceId]);

  // Generate a deterministic color from avatarSeed for the avatar
  const avatarColor = `hsl(${avatarSeed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360}, 60%, 55%)`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-gaming text-text-primary mb-8">{locale['profile.title']}</h1>

      <div className="space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['profile.settings']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white select-none"
                style={{ backgroundColor: avatarColor }}
              >
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <Button variant="ghost" size="sm" onClick={regenerateAvatar}>
                  {locale['profile.regenerateAvatar']}
                </Button>
              </div>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">{locale['profile.displayName']}</label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={32}
                  className="flex-1 max-w-xs px-4 py-2.5 rounded-xl text-sm"
                  style={{
                    backgroundColor: 'var(--color-bg-surface-hover)',
                    color: 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                />
                <Button variant="secondary" size="sm" onClick={handleSaveName}>
                  {nameSaved ? locale['profile.saved'] : locale['profile.save']}
                </Button>
              </div>
            </div>

            {/* Device ID */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">{locale['profile.deviceId']}</label>
              <div className="flex items-center gap-3">
                <code
                  className="px-3 py-2 rounded-lg text-xs font-mono select-all"
                  style={{
                    backgroundColor: 'var(--color-bg-surface-hover)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {deviceId}
                </code>
                <Button variant="ghost" size="sm" onClick={handleCopyId}>
                  {copiedId ? locale['profile.copied'] : locale['profile.copy']}
                </Button>
              </div>
              <p className="text-xs text-text-muted mt-1">
                {locale['profile.deviceIdHint']}
              </p>
            </div>

            {/* Created At */}
            <div>
              <label className="block text-sm text-text-secondary mb-2">{locale['profile.firstVisit']}</label>
              <span className="text-sm text-text-primary">
                {new Date(createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Storage Card */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['profile.storage']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="ghost" size="sm" onClick={handleRefreshStorage}>
              {storageSize ? locale['profile.refresh'] : locale['profile.showStorage']}
            </Button>

            {storageSize && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">{locale['profile.indexedDB']}:</span>
                  <span className="text-text-primary">{formatBytes(storageSize.indexedDB)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">{locale['profile.localStorage']}:</span>
                  <span className="text-text-primary">{formatBytes(storageSize.localStorage)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <span className="text-text-secondary">{locale['profile.total']}:</span>
                  <span className="text-text-primary">
                    {formatBytes(storageSize.indexedDB + storageSize.localStorage)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Export/Import Card */}
        <Card>
          <CardHeader>
            <CardTitle>{locale['profile.dataManagement']}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {locale['profile.exportData']}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleImport}>
                <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {locale['profile.importData']}
              </Button>
            </div>

            {importResult && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  importResult.imported
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                }`}
              >
                {importResult.imported
                  ? locale['profile.importSuccess']
                      .replace('{records}', String(importResult.recordCount))
                      .replace('{tasks}', String(importResult.taskCount))
                  : locale['profile.importFailed'].replace('{error}', importResult.error || 'Unknown error')}
              </div>
            )}

            <p className="text-xs text-text-muted">
              {locale['profile.exportHint']}
            </p>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card>
          <CardHeader>
            <CardTitle style={{ color: 'var(--color-error, #ef4444)' }}>{locale['profile.dangerZone']}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-secondary mb-4">
              {locale['profile.clearWarning']}
            </p>

            {!showClearConfirm ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                style={{
                  color: '#ef4444',
                  borderColor: '#ef4444',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
              >
                {locale['profile.clearAllData']}
              </Button>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <span className="text-sm text-red-400 font-semibold">{locale['profile.confirmClear']}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                  }}
                >
                  {locale['profile.yesDelete']}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowClearConfirm(false)}>
                  {locale['profile.cancel']}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
