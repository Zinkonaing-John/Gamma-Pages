"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  Typography,
  IconButton,
  Chip,
  Box,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import {
  DeleteOutline,
  DescriptionOutlined,
  OpenInNew,
  CloudUpload,
  Close,
  Share,
  Logout,
} from "@mui/icons-material";

interface CardRow {
  id: string;
  user_id: string;
  title: string;
  url: string;
  image_url: string | null;
  created_at: string;
  owner_email?: string;
  is_shared?: boolean;
}

interface ShareRow {
  id: string;
  card_id: string;
  shared_by: string;
  shared_with_email: string;
  shared_with: string | null;
  created_at: string;
}

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)",
  "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
];

function getGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CARD_GRADIENTS[Math.abs(hash) % CARD_GRADIENTS.length];
}

function extractEmbedUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes("gamma.app/embed/")) return trimmed;
  const match = trimmed.match(
    /gamma\.app\/(?:docs|public)\/[^/]*?-?([a-z0-9]+)$/i
  );
  if (match) return `https://gamma.app/embed/${match[1]}`;
  if (/^[a-z0-9]+$/i.test(trimmed))
    return `https://gamma.app/embed/${trimmed}`;
  return trimmed;
}

export default function Home() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newImage, setNewImage] = useState("");
  const [editingCard, setEditingCard] = useState<CardRow | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editImage, setEditImage] = useState("");
  const [deletingCard, setDeletingCard] = useState<CardRow | null>(null);

  // Share dialog state
  const [sharingCard, setSharingCard] = useState<CardRow | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");
  const [cardShares, setCardShares] = useState<ShareRow[]>([]);

  const addFileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Tab: "my" or "shared"
  const [activeTab, setActiveTab] = useState<"my" | "shared">("my");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchCards(session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function fetchCards(currentUser: User) {
    // Fetch own cards
    const { data: ownCards } = await supabase
      .from("cards")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false });

    // Fetch shared cards
    const { data: sharedCardIds } = await supabase
      .from("card_shares")
      .select("card_id, shared_by")
      .or(
        `shared_with.eq.${currentUser.id},shared_with_email.eq.${currentUser.email}`
      );

    let sharedCards: CardRow[] = [];
    if (sharedCardIds && sharedCardIds.length > 0) {
      const ids = sharedCardIds.map((s) => s.card_id);
      const { data } = await supabase
        .from("cards")
        .select("*")
        .in("id", ids)
        .order("created_at", { ascending: false });
      sharedCards = (data || []).map((c) => ({ ...c, is_shared: true }));
    }

    setCards([...(ownCards || []), ...sharedCards]);
    setLoaded(true);
  }

  // Store the raw File for upload
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);

  function handleImageUpload(
    file: File,
    setter: (val: string) => void,
    fileSetter: (f: File) => void
  ) {
    if (!file.type.startsWith("image/")) return;
    fileSetter(file);
    const reader = new FileReader();
    reader.onload = (e) => setter(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadImage(file: File): Promise<string | null> {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("card-images")
      .upload(path, file);
    if (error) {
      console.error("Image upload error:", error.message);
      return null;
    }
    const { data: urlData } = supabase.storage
      .from("card-images")
      .getPublicUrl(path);
    return urlData.publicUrl;
  }

  async function addCard() {
    if (!newUrl.trim()) return;
    if (!user) {
      console.error("No user logged in");
      return;
    }
    const embedUrl = extractEmbedUrl(newUrl);

    let imageUrl: string | null = null;
    if (newImageFile) {
      imageUrl = await uploadImage(newImageFile);
    } else if (newImage.startsWith("data:")) {
      // Convert data URL to File and upload
      const res = await fetch(newImage);
      const blob = await res.blob();
      const file = new File([blob], `upload-${Date.now()}.${blob.type.split("/")[1] || "jpg"}`, { type: blob.type });
      imageUrl = await uploadImage(file);
    } else if (newImage.trim()) {
      imageUrl = newImage.trim();
    }

    const { data, error } = await supabase
      .from("cards")
      .insert({
        user_id: user.id,
        title: newTitle.trim() || "Untitled Gamma Page",
        url: embedUrl,
        image_url: imageUrl,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding card:", error.message, error.code, error.details, error.hint);
      return;
    }
    if (data) {
      setCards([data, ...cards]);
      setNewUrl("");
      setNewTitle("");
      setNewImage("");
      setNewImageFile(null);
    }
  }

  async function removeCard(id: string) {
    const { error } = await supabase.from("cards").delete().eq("id", id);
    if (!error) {
      setCards(cards.filter((c) => c.id !== id));
    }
  }

  function openEditPopup(card: CardRow) {
    setEditingCard(card);
    setEditTitle(card.title);
    setEditUrl(card.url);
    setEditImage(card.image_url || "");
    setEditImageFile(null);
  }

  async function saveEdit() {
    if (!editingCard) return;

    let imageUrl: string | null = null;
    if (editImageFile) {
      imageUrl = await uploadImage(editImageFile);
    } else if (editImage.startsWith("data:")) {
      const res = await fetch(editImage);
      const blob = await res.blob();
      const file = new File([blob], `upload-${Date.now()}.${blob.type.split("/")[1] || "jpg"}`, { type: blob.type });
      imageUrl = await uploadImage(file);
    } else if (editImage.trim()) {
      imageUrl = editImage.trim();
    }

    const { error } = await supabase
      .from("cards")
      .update({
        title: editTitle.trim() || editingCard.title,
        url: editUrl.trim() || editingCard.url,
        image_url: imageUrl,
      })
      .eq("id", editingCard.id);

    if (!error) {
      setCards(
        cards.map((c) =>
          c.id === editingCard.id
            ? {
                ...c,
                title: editTitle.trim() || c.title,
                url: editUrl.trim() || c.url,
                image_url: imageUrl,
              }
            : c
        )
      );
      setEditingCard(null);
    }
  }

  async function openShareDialog(card: CardRow) {
    setSharingCard(card);
    setShareEmail("");
    setShareError("");
    setShareSuccess("");

    const { data } = await supabase
      .from("card_shares")
      .select("*")
      .eq("card_id", card.id);
    setCardShares(data || []);
  }

  async function shareCard() {
    if (!sharingCard || !shareEmail.trim() || !user) return;
    setShareLoading(true);
    setShareError("");
    setShareSuccess("");

    if (shareEmail.trim() === user.email) {
      setShareError("You can't share with yourself.");
      setShareLoading(false);
      return;
    }

    const { error } = await supabase.from("card_shares").insert({
      card_id: sharingCard.id,
      shared_by: user.id,
      shared_with_email: shareEmail.trim().toLowerCase(),
    });

    if (error) {
      if (error.code === "23505") {
        setShareError("Already shared with this email.");
      } else {
        setShareError(error.message);
      }
    } else {
      setShareSuccess(`Shared with ${shareEmail.trim()}`);
      setShareEmail("");
      // Refresh shares list
      const { data } = await supabase
        .from("card_shares")
        .select("*")
        .eq("card_id", sharingCard.id);
      setCardShares(data || []);
    }
    setShareLoading(false);
  }

  async function removeShare(shareId: string) {
    await supabase.from("card_shares").delete().eq("id", shareId);
    setCardShares(cardShares.filter((s) => s.id !== shareId));
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const myCards = cards.filter((c) => c.user_id === user?.id);
  const sharedCards = cards.filter((c) => c.is_shared);
  const displayCards = activeTab === "my" ? myCards : sharedCards;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Docs Embed
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Embed and view your Docs
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {user.email}
              </span>
              <Tooltip title="Sign out" arrow>
                <IconButton onClick={handleLogout} size="small" sx={{ color: "white" }}>
                  <Logout fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {/* Add new card */}
        <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Add a Docs Page
          </h2>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                placeholder="Title (optional)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 sm:w-48"
              />
              <input
                type="text"
                placeholder="Gamma URL or embed link"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCard()}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                placeholder="Cover image URL (optional)"
                value={
                  newImage.startsWith("data:")
                    ? "Local image selected"
                    : newImage
                }
                onChange={(e) => {
                  setNewImage(e.target.value);
                  setNewImageFile(null);
                }}
                onFocus={() => {
                  if (newImage.startsWith("data:")) {
                    setNewImage("");
                    setNewImageFile(null);
                  }
                }}
                className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <input
                ref={addFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, setNewImage, setNewImageFile);
                  e.target.value = "";
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => addFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  <CloudUpload sx={{ fontSize: 16 }} />
                  Upload
                </button>
                {newImage && (
                  <button
                    type="button"
                    onClick={() => { setNewImage(""); setNewImageFile(null); }}
                    className="flex items-center rounded-md border border-zinc-300 px-2 py-2 text-sm text-zinc-400 transition-colors hover:text-red-500 dark:border-zinc-700"
                    title="Remove image"
                  >
                    <Close sx={{ fontSize: 16 }} />
                  </button>
                )}
                <button
                  onClick={addCard}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Add
                </button>
              </div>
            </div>
            {newImage && (
              <div className="relative mt-1 h-20 w-32 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
                <img
                  src={newImage}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-zinc-400">
            Paste a Docs share link (e.g. https://gamma.app/docs/My-Page-abc123)
            or embed URL
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            onClick={() => setActiveTab("my")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "my"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            My Docs ({myCards.length})
          </button>
          <button
            onClick={() => setActiveTab("shared")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "shared"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Shared with me ({sharedCards.length})
          </button>
        </div>

        {/* Card grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {displayCards.map((card) => (
            <Card
              key={card.id}
              sx={{
                position: "relative",
                borderRadius: 3,
                overflow: "hidden",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                background:
                  "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                border: "1px solid",
                borderColor: "grey.200",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: "0 12px 40px -12px rgba(0,0,0,0.15)",
                  borderColor: "primary.light",
                  "& .action-btns": { opacity: 1 },
                },
              }}
            >
              <CardActionArea
                onClick={() =>
                  card.is_shared
                    ? router.push(
                        `/view?url=${encodeURIComponent(card.url)}&title=${encodeURIComponent(card.title)}`
                      )
                    : openEditPopup(card)
                }
                sx={{ p: 0 }}
              >
                {card.image_url ? (
                  <CardMedia
                    component="img"
                    height="140"
                    image={card.image_url}
                    alt={card.title}
                    sx={{ height: 140, objectFit: "cover" }}
                  />
                ) : (
                  <Box
                    sx={{
                      height: 140,
                      background: getGradient(card.id),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <DescriptionOutlined
                      sx={{ color: "rgba(255,255,255,0.4)", fontSize: 48 }}
                    />
                  </Box>
                )}
                <CardContent sx={{ p: 3, pb: 2 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 1.5,
                      mb: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        background:
                          "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <DescriptionOutlined
                        sx={{ color: "#fff", fontSize: 20 }}
                      />
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 600,
                          color: "grey.900",
                          lineHeight: 1.3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {card.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "grey.500",
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          mt: 0.5,
                        }}
                      >
                        {card.url}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 1,
                    }}
                  >
                    <Chip
                      label={card.is_shared ? "Shared" : "Gamma Doc"}
                      size="small"
                      sx={{
                        fontSize: "0.7rem",
                        height: 22,
                        background: card.is_shared
                          ? "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)"
                          : "linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%)",
                        color: card.is_shared ? "#059669" : "#6366f1",
                        fontWeight: 600,
                        border: "none",
                      }}
                    />
                  </Box>
                </CardContent>
              </CardActionArea>

              <Box
                className="action-btns"
                sx={{
                  position: "absolute",
                  top: 8,
                  right: 4,
                  opacity: 0,
                  transition: "all 0.2s",
                  display: "flex",
                  gap: 0.5,
                }}
              >
                <Tooltip title="View" arrow>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(
                        `/view?url=${encodeURIComponent(card.url)}&title=${encodeURIComponent(card.title)}`
                      );
                    }}
                    sx={{
                      color: "grey.400",
                      "&:hover": {
                        color: "primary.main",
                        backgroundColor: "primary.50",
                      },
                    }}
                  >
                    <OpenInNew fontSize="small" />
                  </IconButton>
                </Tooltip>
                {!card.is_shared && (
                  <>
                    <Tooltip title="Share" arrow>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openShareDialog(card);
                        }}
                        sx={{
                          color: "grey.400",
                          "&:hover": {
                            color: "success.main",
                            backgroundColor: "success.50",
                          },
                        }}
                      >
                        <Share fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete" arrow>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingCard(card);
                        }}
                        sx={{
                          color: "grey.400",
                          "&:hover": {
                            color: "error.main",
                            backgroundColor: "error.50",
                          },
                        }}
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </Box>
            </Card>
          ))}
        </div>

        {loaded && displayCards.length === 0 && (
          <div className="py-20 text-center text-zinc-400">
            {activeTab === "my"
              ? "No docs added yet. Add one above to get started."
              : "No docs have been shared with you yet."}
          </div>
        )}

        {/* Edit Popup */}
        {editingCard && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setEditingCard(null)}
          >
            <div
              className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Edit Page
              </h2>
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    URL
                  </label>
                  <input
                    type="text"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Cover Image
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://example.com/image.jpg"
                      value={
                        editImage.startsWith("data:")
                          ? "Local image selected"
                          : editImage
                      }
                      onChange={(e) => {
                        setEditImage(e.target.value);
                        setEditImageFile(null);
                      }}
                      onFocus={() => {
                        if (editImage.startsWith("data:")) {
                          setEditImage("");
                          setEditImageFile(null);
                        }
                      }}
                      className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, setEditImage, setEditImageFile);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => editFileInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <CloudUpload sx={{ fontSize: 16 }} />
                      Upload
                    </button>
                    {editImage && (
                      <button
                        type="button"
                        onClick={() => setEditImage("")}
                        className="flex items-center rounded-md border border-zinc-300 px-2 py-2 text-sm text-zinc-400 transition-colors hover:text-red-500 dark:border-zinc-600"
                        title="Remove image"
                      >
                        <Close sx={{ fontSize: 16 }} />
                      </button>
                    )}
                  </div>
                  {editImage && (
                    <div className="relative mt-2 h-20 w-32 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700">
                      <img
                        src={editImage}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  onClick={() => setEditingCard(null)}
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    router.push(
                      `/view?url=${encodeURIComponent(editingCard.url)}&title=${encodeURIComponent(editingCard.title)}`
                    )
                  }
                  className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  View
                </button>
                <button
                  onClick={saveEdit}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={!!deletingCard}
          onClose={() => setDeletingCard(null)}
          PaperProps={{ sx: { borderRadius: 3, px: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>Delete Page</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete{" "}
              <strong>{deletingCard?.title}</strong>? This action cannot be
              undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setDeletingCard(null)}
              sx={{ textTransform: "none", fontWeight: 500 }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (deletingCard) removeCard(deletingCard.id);
                setDeletingCard(null);
              }}
              color="error"
              variant="contained"
              sx={{ textTransform: "none", fontWeight: 500 }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Share Dialog */}
        <Dialog
          open={!!sharingCard}
          onClose={() => setSharingCard(null)}
          PaperProps={{ sx: { borderRadius: 3, px: 1, minWidth: 400 } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>
            Share &ldquo;{sharingCard?.title}&rdquo;
          </DialogTitle>
          <DialogContent>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Enter email to share with"
                  value={shareEmail}
                  onChange={(e) => {
                    setShareEmail(e.target.value);
                    setShareError("");
                    setShareSuccess("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && shareCard()}
                  className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <button
                  onClick={shareCard}
                  disabled={shareLoading || !shareEmail.trim()}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
                >
                  Share
                </button>
              </div>
              {shareError && (
                <p className="text-sm text-red-500">{shareError}</p>
              )}
              {shareSuccess && (
                <p className="text-sm text-green-600">{shareSuccess}</p>
              )}

              {cardShares.length > 0 && (
                <div className="mt-2">
                  <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Shared with:
                  </p>
                  <div className="flex flex-col gap-2">
                    {cardShares.map((share) => (
                      <div
                        key={share.id}
                        className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                      >
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {share.shared_with_email}
                        </span>
                        <button
                          onClick={() => removeShare(share.id)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => setSharingCard(null)}
              sx={{ textTransform: "none", fontWeight: 500 }}
            >
              Done
            </Button>
          </DialogActions>
        </Dialog>
      </main>
    </div>
  );
}
