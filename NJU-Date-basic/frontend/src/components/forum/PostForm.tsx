import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { ForumPostType, ForumVisibility } from '../../api/forum';
import { createPost } from '../../api/forum';
import { toast } from '../Toast';
import { ApiError } from '../../api/client';
import MaterialIcon from '../MaterialIcon';
import ImageUploader, { getUploadedUrls, hasUploading, nextPreviewId } from '../common/ImageUploader';
import type { ImagePreview } from '../common/ImageUploader';

const TYPE_OPTIONS: { value: ForumPostType; label: string; desc: string }[] = [
  { value: 'general', label: '交流', desc: '闲聊、经验分享、日常讨论' },
  { value: 'squad', label: '组队', desc: '游戏、运动、临时组队' },
  { value: 'help', label: '互助', desc: '快递代取、学习辅导、借用物品' },
  { value: 'trade', label: '二手', desc: '二手书、闲置物品交换' },
  { value: 'activity', label: '活动', desc: '线下活动、志愿活动、比赛组队' },
];

const MAX_IMAGES = 9;

interface ForumPostDraft {
  version: 1;
  savedAt: string;
  title: string;
  content: string;
  type: ForumPostType;
  isAnonymous: boolean;
  visibility: ForumVisibility;
  images: string[];
  pollEnabled: boolean;
  pollOptions: string[];
}

const DRAFT_KEY = 'forum:draft:global';
const MAX_POLL_OPTIONS = 4;
const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTION_LENGTH = 15;

function getDraftKey() {
  return DRAFT_KEY;
}

function loadDraft(key: string): ForumPostDraft | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ForumPostDraft;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDraft(key: string, draft: ForumPostDraft) {
  localStorage.setItem(key, JSON.stringify(draft));
}

function clearDraft(key: string) {
  localStorage.removeItem(key);
}

interface PostFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  circleId?: string | null;
  circleName?: string;
  defaultType?: ForumPostType;
  profileComplete: boolean;
}

export default function PostForm({
  isOpen,
  onClose,
  onSuccess,
  circleId,
  circleName,
  defaultType,
  profileComplete,
}: PostFormProps) {
  const [type, setType] = useState<ForumPostType>(defaultType || 'general');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [visibility, setVisibility] = useState<ForumVisibility>('public');
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [submitting, setSubmitting] = useState(false);
  const [showDraftDialog, setShowDraftDialog] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowDraftDialog(false);
      const draft = loadDraft(getDraftKey());
      if (draft) {
        setType(draft.type);
        setTitle(draft.title);
        setContent(draft.content);
        setIsAnonymous(draft.isAnonymous);
        setVisibility(draft.visibility);
        setImages(
          draft.images.map((url) => ({
            id: nextPreviewId(),
            previewUrl: url,
            uploading: false,
            uploadedUrl: url,
          })),
        );
        setPollEnabled(draft.pollEnabled);
        setPollOptions(draft.pollOptions.length >= 2 ? draft.pollOptions.slice(0, 4) : ['', '']);
      } else {
        setType(defaultType || 'general');
        setTitle('');
        setContent('');
        setIsAnonymous(false);
        setVisibility('public');
        setImages([]);
        setPollEnabled(false);
        setPollOptions(['', '']);
      }
    }
  }, [isOpen, defaultType]);

  const canPost = type === 'squad' || profileComplete;
  const isValid = title.trim().length > 0 && content.trim().length > 0 && canPost;

  const resetForm = () => {
    setImages([]);
    setTitle('');
    setContent('');
    setType(defaultType || 'general');
    setIsAnonymous(false);
    setVisibility('public');
    setImages([]);
    setPollEnabled(false);
    setPollOptions(['', '']);
  };

  const getValidPollOptions = () => pollOptions.map((item) => item.trim()).filter(Boolean);

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const addPollOption = () => {
    setPollOptions((prev) => (prev.length >= MAX_POLL_OPTIONS ? prev : [...prev, '']));
  };

  const removePollOption = (index: number) => {
    setPollOptions((prev) => {
      if (prev.length <= MIN_POLL_OPTIONS) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.warning('请输入帖子标题');
      return;
    }
    if (!content.trim()) {
      toast.warning('请输入帖子内容');
      return;
    }
    if (!canPost) {
      toast.warning('请先完成个人资料');
      return;
    }
    let normalizedPollOptions: string[] | undefined;
    if (pollEnabled) {
      const options = getValidPollOptions();
      if (options.length < MIN_POLL_OPTIONS) {
        toast.warning('投票至少需要 2 个选项');
        return;
      }
      if (options.some((item) => item.length > MAX_POLL_OPTION_LENGTH)) {
        toast.warning('投票选项不能超过 15 字');
        return;
      }
      if (new Set(options).size !== options.length) {
        toast.warning('投票选项不能重复');
        return;
      }
      normalizedPollOptions = options;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const uploadedUrls = getUploadedUrls(images);

      await createPost({
        circleId: circleId ?? null,
        title: title.trim(),
        content: content.trim(),
        type,
        isAnonymous,
        visibility,
        images: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        pollOptions: normalizedPollOptions,
      });
      toast.success('发布成功');
      clearDraft(getDraftKey());
      resetForm();
      onSuccess();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : '发布失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const persistCurrentDraft = () => {
    const uploadedUrls = getUploadedUrls(images);
    saveDraft(getDraftKey(), {
      version: 1,
      savedAt: new Date().toISOString(),
      title,
      content,
      type,
      isAnonymous,
      visibility,
      images: uploadedUrls,
      pollEnabled,
      pollOptions,
    });
  };

  const closeWithoutDraft = () => {
    clearDraft(getDraftKey());
    resetForm();
    setShowDraftDialog(false);
    onClose();
  };

  const closeWithDraft = () => {
    if (hasUploading(images)) {
      toast.warning('图片上传中，暂不能保存草稿');
      return;
    }
    persistCurrentDraft();
    resetForm();
    setShowDraftDialog(false);
    onClose();
  };

  const handleClose = () => {
    if (submitting) return;
    if (hasUploading(images)) {
      toast.warning('图片上传中，请稍等片刻再关闭');
      return;
    }
    if (!title.trim() && !content.trim()) {
      closeWithoutDraft();
      return;
    }
    setShowDraftDialog(true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.97 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-[#FCFBF8] rounded-t-3xl md:rounded-3xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-[0_-8px_40px_rgb(0,0,0,0.12)]"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-[#8B7355] hover:bg-[#EAE7E1] transition-colors"
            >
              ✕
            </button>

            <h2 className="text-xl font-serif text-[#2C2825] mb-6">
              {circleName ? `在「${circleName}」发帖` : '发布帖子'}
            </h2>

            {/* Type selector */}
            <div className="mb-5">
              <label className="block text-xs uppercase tracking-[0.25em] text-[#8B7355]/80 mb-3">
                帖子类型
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`text-left px-3 py-2 rounded-xl border transition-all duration-200 ${
                      type === opt.value
                        ? 'border-[#420047]/40 bg-[#420047]/5'
                        : 'border-[#EAE7E1] hover:border-[#8B7355]/30'
                    }`}
                  >
                    <div className={`text-sm font-medium ${type === opt.value ? 'text-[#420047]' : 'text-[#2C2825]'}`}>
                      {opt.label}
                    </div>
                    <div className="text-[10px] text-[#8B7355] mt-0.5">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Qualification hint */}
            {!canPost && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 text-amber-800 text-xs leading-relaxed">
                此类型帖子需要完成个人资料后才能发布。
                <Link to="/onboarding" className="underline ml-1">前往完善资料 →</Link>
              </div>
            )}
            {type === 'squad' && (
              <div className="mb-4 p-3 rounded-xl bg-[#420047]/5 text-[#420047] text-xs leading-relaxed">
                组队帖无资格限制，可直接发布。
              </div>
            )}

            {/* Title */}
            <div className="mb-4">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="帖子标题"
                maxLength={30}
                className="w-full bg-transparent text-[#2C2825] text-lg font-serif placeholder:text-[#8B7355]/50 outline-none border-b border-[#EAE7E1] pb-2 focus:border-b-[#420047]/40 transition-colors"
              />
              <div className="text-right text-[10px] text-[#8B7355]/60 mt-1">
                {title.length}/30
              </div>
            </div>

            {/* Content */}
            <div className="mb-4">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="写下你想说的话..."
                maxLength={10000}
                rows={4}
                className="w-full bg-transparent text-[#2C2825] text-sm leading-relaxed placeholder:text-[#8B7355]/50 outline-none border-b border-[#EAE7E1] pb-2 focus:border-b-[#420047]/40 transition-colors resize-none"
              />
              <div className="text-right text-[10px] text-[#8B7355]/60 mt-1">
                {content.length}/10000
              </div>
            </div>

            {/* Poll */}
            <div className="mb-4 rounded-2xl border border-[#EAE7E1] bg-white/50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-[#2C2825]">发起投票</span>
                  <p className="text-[10px] text-[#8B7355]/60 mt-0.5">
                    最多 4 个选项，每项 15 字内
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPollEnabled(!pollEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    pollEnabled ? 'bg-[#420047]' : 'bg-[#EAE7E1]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      pollEnabled ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
              {pollEnabled && (
                <div className="mt-4 space-y-2">
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updatePollOption(index, e.target.value)}
                        placeholder={`选项 ${index + 1}`}
                        maxLength={MAX_POLL_OPTION_LENGTH}
                        className="min-w-0 flex-1 rounded-xl border border-[#EAE7E1] bg-[#FCFBF8] px-3 py-2 text-sm text-[#2C2825] outline-none transition-colors focus:border-[#420047]/40"
                      />
                      <span className="w-10 text-right text-[10px] text-[#8B7355]/60">
                        {option.length}/{MAX_POLL_OPTION_LENGTH}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePollOption(index)}
                        disabled={pollOptions.length <= MIN_POLL_OPTIONS}
                        className="h-8 w-8 rounded-full text-[#8B7355]/60 transition-colors hover:bg-[#EAE7E1] hover:text-red-500 disabled:opacity-30"
                        aria-label="删除选项"
                      >
                        <MaterialIcon name="close" className="text-[16px] leading-none" />
                      </button>
                    </div>
                  ))}
                  {pollOptions.length < MAX_POLL_OPTIONS && (
                    <button
                      type="button"
                      onClick={addPollOption}
                      className="inline-flex items-center gap-1 rounded-full border border-[#EAE7E1] px-3 py-1.5 text-xs text-[#8B7355] transition-colors hover:border-[#420047]/30 hover:text-[#420047]"
                    >
                      <MaterialIcon name="add" className="text-[14px] leading-none" />
                      添加选项
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Image upload */}
            <div className="mb-4">
              <ImageUploader
                value={images}
                onChange={setImages}
                maxCount={MAX_IMAGES}
                maxSizeMB={5}
                scene="post"
                disabled={submitting}
              />
            </div>

            {/* Anonymous toggle */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="text-sm text-[#2C2825]">匿名发帖</span>
                <p className="text-[10px] text-[#8B7355]/60 mt-0.5">
                  发帖后作者名显示"匿名"，可后续取消
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  isAnonymous ? 'bg-[#420047]' : 'bg-[#EAE7E1]'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    isAnonymous ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Privacy toggle */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <span className="text-sm text-[#2C2825]">私密帖子</span>
                <p className="text-[10px] text-[#8B7355]/60 mt-0.5">
                  仅自己和管理员可见
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVisibility(visibility === 'private' ? 'public' : 'private')}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  visibility === 'private' ? 'bg-[#420047]' : 'bg-[#EAE7E1]'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    visibility === 'private' ? 'left-5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Submit */}
            <button
              type="button"
              disabled={submitting || hasUploading(images) || !isValid}
              onClick={handleSubmit}
              className="w-full py-3 rounded-xl font-sans text-sm tracking-widest transition-all duration-300
                bg-[#420047] text-[#FCFBF8] hover:bg-[#2A002D] shadow-md
                disabled:bg-[#EAE7E1] disabled:text-[#8B7355]/50 disabled:shadow-none disabled:cursor-not-allowed"
            >
              {submitting ? '发布中...' : '发 布'}
            </button>
          </motion.div>

          {showDraftDialog && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#2C2825]/35 px-4 backdrop-blur-[2px]">
              <div className="w-full max-w-md overflow-hidden rounded-[24px] bg-[#FCFBF8] shadow-[0_24px_80px_rgba(44,40,37,0.18),0_0_0_1px_rgba(234,231,225,0.72)]">
                <div className="flex items-start gap-4 px-6 pb-5 pt-6">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#420047]/15 bg-[#420047]/5 text-[#420047]">
                    <MaterialIcon name="draft" className="text-[21px] leading-none" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-serif text-xl tracking-widest text-[#2C2825]">保存草稿？</h2>
                    <p className="mt-3 text-sm font-serif leading-relaxed text-[#8B7355]">
                      这次编辑还没有发布，要保存到本机草稿箱，下次发帖时继续吗？
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap justify-end gap-3 border-t border-[#EAE7E1]/65 bg-[#F7F4EF]/45 px-6 py-4">
                  <button
                    type="button"
                    onClick={() => setShowDraftDialog(false)}
                    className="rounded-full border border-[#EAE7E1]/90 bg-[#FCFBF8] px-5 py-2 text-sm font-serif tracking-widest text-[#8B7355] transition hover:bg-white hover:text-[#2C2825]"
                  >
                    继续编辑
                  </button>
                  <button
                    type="button"
                    onClick={closeWithoutDraft}
                    className="rounded-full border border-[#EAE7E1]/90 bg-[#FCFBF8] px-5 py-2 text-sm font-serif tracking-widest text-[#8B7355] transition hover:bg-white hover:text-red-500"
                  >
                    不保存
                  </button>
                  <button
                    type="button"
                    onClick={closeWithDraft}
                    className="rounded-full bg-[#420047] px-5 py-2 text-sm font-serif tracking-widest text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#5C0064]"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
