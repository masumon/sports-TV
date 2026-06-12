"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Upload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/apiClient";

type PlaylistImportResult = {
  success: boolean;
  playlist_id?: number;
  playlist_name?: string;
  created?: number;
  updated?: number;
  total?: number;
  error?: string;
};

export function PlaylistUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [selectedModule, setSelectedModule] = useState("global_sports");
  const [fileContent, setFileContent] = useState<string>("");
  const [result, setResult] = useState<PlaylistImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);

      // Auto-extract playlist name from filename
      const nameFromFile = file.name.replace(/\.(m3u|m3u8|txt)$/i, "");
      setPlaylistName(nameFromFile);

      toast.success(`File loaded: ${file.name}`);
    };
    reader.onerror = () => {
      toast.error("Failed to read file");
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!playlistName.trim()) {
      toast.error("Please enter playlist name");
      return;
    }
    if (!fileContent.trim()) {
      toast.error("Please select M3U8 file");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/v1/admin/playlists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playlistName.trim(),
          content: fileContent,
          module: selectedModule,
        }),
      });

      const data: PlaylistImportResult = await response.json();
      setResult(data);

      if (data.success) {
        toast.success(`Imported ${data.total} channels from "${data.playlist_name}"`);
        setFileContent("");
        setPlaylistName("");
      } else {
        toast.error(data.error || "Import failed");
      }
    } catch (err) {
      toast.error("Import request failed");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Drag-drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-accent-gold bg-accent-gold/10"
            : "border-border-subtle hover:border-accent-gold/50"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".m3u,.m3u8,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(245,166,35,0.1)" }}>
            <Upload size={32} style={{ color: "#F5A623" }} />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">Drag M3U8 file here</p>
            <p className="text-sm text-muted-foreground mt-1">or click to select</p>
          </div>
        </motion.div>
      </div>

      {/* File preview */}
      {fileContent && (
        <div className="rounded-xl border border-border-subtle p-4 bg-surface-secondary/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">M3U8 Preview</p>
              <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto font-mono">
                {fileContent.slice(0, 300)}
                {fileContent.length > 300 ? "..." : ""}
              </p>
            </div>
            <button
              onClick={() => setFileContent("")}
              className="shrink-0 text-muted-foreground hover:text-foreground transition"
              aria-label="Clear"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Playlist Name</label>
          <input
            type="text"
            value={playlistName}
            onChange={(e) => setPlaylistName(e.target.value)}
            placeholder="e.g., BD Sports 2026"
            className="w-full rounded-xl border border-border-subtle bg-surface-secondary px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent-gold transition"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2 text-foreground">Module</label>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="w-full rounded-xl border border-border-subtle bg-surface-secondary px-4 py-2.5 text-sm text-foreground outline-none focus:border-accent-gold transition"
          >
            <option value="global_sports">🌍 Global Sports</option>
            <option value="bangladesh">🇧🇩 Bangladesh</option>
            <option value="india">🇮🇳 India</option>
            <option value="fast_tv">⚡ FAST TV</option>
          </select>
        </div>
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={!fileContent || !playlistName.trim() || isLoading}
        className="w-full rounded-xl px-6 py-3 text-sm font-bold text-black transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          background:
            fileContent && playlistName.trim() && !isLoading
              ? "#F5A623"
              : "rgba(245,166,35,0.3)",
        }}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            Importing...
          </span>
        ) : (
          "Import Playlist"
        )}
      </button>

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl p-4 border ${
            result.success
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-rose-500/10 border-rose-500/30"
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 size={20} className="shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle size={20} className="shrink-0 text-rose-400 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              {result.success ? (
                <div>
                  <p className="font-semibold text-emerald-400">Import successful!</p>
                  <p className="text-sm text-emerald-300/80 mt-1">
                    Created {result.created} new channels, updated {result.updated} existing channels
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-rose-400">Import failed</p>
                  <p className="text-sm text-rose-300/80 mt-1">{result.error}</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
