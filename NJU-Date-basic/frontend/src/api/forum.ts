import { api } from './client';

// ─── Shared Enums ────────────────────────────────────────────

export type ForumPostType = 'general' | 'squad' | 'help' | 'trade' | 'activity';
export type ForumVisibility = 'public' | 'private';
export type ForumCommentType = 'text' | 'voice';
export type ForumSort = 'latest' | 'hot' | 'recommended';
export type AuthorScope = 'all' | 'mine' | 'liked' | 'favorited';
export type HotRankingRange = 'day' | 'week' | 'month';
export type ForumReportReason =
  | 'pornographic'
  | 'violent'
  | 'personal_attack'
  | 'provocation'
  | 'ad_spam'
  | 'junk_info'
  | 'privacy_violation'
  | 'other';

// ─── Author ──────────────────────────────────────────────────

export interface AuthorDTO {
  userId?: string;
  nickname: string;
  avatarUrl: string | null;
  isOwn: boolean;
}

// ─── Post List ───────────────────────────────────────────────

export interface PostListItem {
  postId: string;
  circleId: string | null;
  title: string;
  type: ForumPostType;
  author: AuthorDTO;
  isAnonymous: boolean;
  visibility: ForumVisibility;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  viewCount: number;
  hotScore: number;
  hasImages: boolean;
  hasPoll: boolean;
  likedByMe: boolean;
  favoritedByMe: boolean;
  isPinned: boolean;
  summary?: string | null;
  coverImageUrl?: string | null;
  createdAt: string;
}

export interface PostListResponse {
  total: number;
  page: number;
  limit: number;
  posts: PostListItem[];
}

// ─── Post Detail ─────────────────────────────────────────────

export interface PostImage {
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
}

export interface PostDetail {
  postId: string;
  circleId: string | null;
  title: string;
  content: string;
  type: ForumPostType;
  author: AuthorDTO;
  isAnonymous: boolean;
  visibility: ForumVisibility;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  hotScore: number;
  hasImages: boolean;
  hasPoll: boolean;
  poll: ForumPoll | null;
  isPinned: boolean;
  pinnedCommentId: string | null;
  canPinComments: boolean;
  likedByMe: boolean;
  favoritedByMe: boolean;
  images: PostImage[];
  createdAt: string;
}

// ─── Comment ─────────────────────────────────────────────────

// Level-1 comment (direct reply to post)
export interface CommentItem {
  commentId: string;
  author: AuthorDTO;
  content: string | null;
  commentType: ForumCommentType;
  voiceUrl: string | null;
  voiceDurationSec: number | null;
  imageUrl: string | null;
  transcript: string | null;
  transcriptStatus: 'none' | 'pending' | 'success' | 'failed';
  parentCommentId: string | null;
  createdAt: string | null;
  likeCount: number;
  likedByMe: boolean;
  isDeleted: boolean;
  isAnonymousOP: boolean;
  isPinned: boolean;
  canPinByMe: boolean;
  replyCount: number;
  previewReplies: ReplyItem[];
}

export interface ForumPollOption {
  optionId: string;
  text: string;
  voteCount: number;
  displayOrder: number;
}

export interface ForumPoll {
  totalVotes: number;
  myVoteOptionId: string | null;
  votedByMe: boolean;
  options: ForumPollOption[];
}

// Level-2 reply (sub-reply under a level-1 comment)
export interface ReplyItem {
  commentId: string;
  author: AuthorDTO;
  content: string | null;
  commentType: ForumCommentType;
  voiceUrl: string | null;
  voiceDurationSec: number | null;
  imageUrl: string | null;
  transcript: string | null;
  transcriptStatus: 'none' | 'pending' | 'success' | 'failed';
  parentCommentId: string | null;
  replyToNickname: string | null;
  likeCount: number;
  likedByMe: boolean;
  isDeleted: boolean;
  isAnonymousOP: boolean;
  createdAt: string | null;
}

export interface PostDetailResponse {
  post: PostDetail;
  comments: CommentItem[];
}

export interface CommentRepliesResponse {
  total: number;
  page: number;
  limit: number;
  replies: ReplyItem[];
}

// ─── Create / Update Payloads ────────────────────────────────

export interface CreatePostPayload {
  circleId?: string | null;
  title: string;
  content: string;
  type: ForumPostType;
  isAnonymous?: boolean;
  visibility?: ForumVisibility;
  images?: string[];
  pollOptions?: string[];
}

export interface MyForumMessageItem {
  messageId: string;
  type: string;
  senderNickname: string;
  actionType: 'like' | 'favorite' | 'comment' | 'reply';
  targetType: 'post' | 'comment';
  contentSnippet: string;
  isRead: boolean;
  postId: string | null;
  createdAt: string;
  meta: {
    postId?: string;
    commentId?: string;
    actorId?: string;
    [key: string]: any;
  };
  title: string;
  content: string;
  actor: {
    userId: string;
    nickname: string;
    avatarUrl: string | null;
  };
}

export interface MyMessagesResponse {
  total: number;
  page: number;
  limit: number;
  messages: MyForumMessageItem[];
}

// ─── API Functions ──────────────────────────────────────────
export interface CreateCommentPayload {
  content?: string;
  parentCommentId?: string | null;
  commentType?: ForumCommentType;
  voiceUrl?: string;
  voiceDurationSec?: number;
  imageUrl?: string;
}

// ─── Hot Ranking ─────────────────────────────────────────────

export interface HotRankingItem {
  rank: number;
  postId: string;
  circleId: string | null;
  title: string;
  type: ForumPostType;
  author: AuthorDTO;
  isAnonymous: boolean;
  hotScore: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  viewCount: number;
  hasImages: boolean;
  summary?: string | null;
  coverImageUrl?: string | null;
  createdAt: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  priority: number;
  createdAt: string;
}

export interface AnnouncementDetail extends AnnouncementItem {
  content: string;
}

// ─── Guestbook ───────────────────────────────────────────────

export interface GuestbookMessage {
  id: string;
  content: string;
  createdAt: string;
  author: {
    userId: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
}

export interface GuestbookListResponse {
  total: number;
  page: number;
  limit: number;
  messages: GuestbookMessage[];
}

// ─── API Functions ───────────────────────────────────────────

// Posts
export function getPosts(params: {
  circleId?: string;
  type?: ForumPostType;
  page?: number;
  limit?: number;
  sort?: ForumSort;
  authorScope?: AuthorScope;
  keyword?: string;
}) {
  const sp = new URLSearchParams();
  if (params.circleId) sp.set('circleId', params.circleId);
  if (params.type) sp.set('type', params.type);
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  if (params.sort) sp.set('sort', params.sort);
  if (params.authorScope) sp.set('authorScope', params.authorScope);
  if (params.keyword?.trim()) sp.set('keyword', params.keyword.trim());
  const qs = sp.toString();
  return api.get<PostListResponse>(`/forum/posts${qs ? `?${qs}` : ''}`);
}

export function getMyPosts(params: { page?: number; limit?: number } = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return api.get<PostListResponse>(`/forum/me/posts${qs ? `?${qs}` : ''}`);
}

export function getLikedPosts(params: { page?: number; limit?: number } = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return api.get<PostListResponse>(`/forum/me/liked-posts${qs ? `?${qs}` : ''}`);
}

export function getFavoritedPosts(params: { page?: number; limit?: number } = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return api.get<PostListResponse>(`/forum/me/favorited-posts${qs ? `?${qs}` : ''}`);
}


export function getMyMessages(params: { page?: number; limit?: number } = {}) {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return api.get<MyMessagesResponse>(`/forum/me/messages${qs ? `?${qs}` : ''}`);
}

export function markMessageRead(messageId: string) {
  return api.patch<{ message: string }>(
    `/user/notifications/${encodeURIComponent(messageId)}/read`,
    {},
  );
}

export function createPost(data: CreatePostPayload) {
  return api.post<{ postId: string; message: string }>('/forum/posts', data);
}

export function getPostDetail(postId: string) {
  return api.get<PostDetailResponse>(`/forum/posts/${encodeURIComponent(postId)}`);
}

export function deletePost(postId: string) {
  return api.delete<{ message: string }>(`/forum/posts/${encodeURIComponent(postId)}`);
}

export function pinComment(postId: string, commentId: string) {
  return api.put<{ message: string; pinnedCommentId: string }>(
    `/forum/posts/${encodeURIComponent(postId)}/pinned-comment`,
    { commentId },
  );
}

export function unpinComment(postId: string) {
  return api.delete<{ message: string; pinnedCommentId: null }>(
    `/forum/posts/${encodeURIComponent(postId)}/pinned-comment`,
  );
}

export function votePostPoll(postId: string, optionId: string) {
  return api.post<{ message: string } & ForumPoll>(
    `/forum/posts/${encodeURIComponent(postId)}/poll/vote`,
    { optionId },
  );
}

// Anonymous & Privacy
export function cancelAnonymous(postId: string) {
  return api.patch<{ message: string }>(
    `/forum/posts/${encodeURIComponent(postId)}/cancel-anonymous`,
    {},
  );
}

export function updatePostPrivacy(postId: string, visibility: ForumVisibility) {
  return api.patch<{ message: string; visibility: ForumVisibility }>(
    `/forum/posts/${encodeURIComponent(postId)}/privacy`,
    { visibility },
  );
}

// Toggle anonymity (replaces deprecated cancelAnonymous)
export function togglePostAnonymity(postId: string, isAnonymous: boolean) {
  return api.patch<{ isAnonymous: boolean; message: string }>(
    `/forum/posts/${encodeURIComponent(postId)}/anonymity`,
    { isAnonymous },
  );
}

// Likes
export function likePost(postId: string) {
  return api.post<{ message: string; liked: boolean }>(
    `/forum/posts/${encodeURIComponent(postId)}/like`,
    {},
  );
}

export function unlikePost(postId: string) {
  return api.delete<{ message: string; liked: boolean }>(
    `/forum/posts/${encodeURIComponent(postId)}/like`,
  );
}

// Favorites
export function favoritePost(postId: string) {
  return api.post<{ message: string; favorited: boolean }>(
    `/forum/posts/${encodeURIComponent(postId)}/favorite`,
    {},
  );
}

export function unfavoritePost(postId: string) {
  return api.delete<{ message: string; favorited: boolean }>(
    `/forum/posts/${encodeURIComponent(postId)}/favorite`,
  );
}

// Comments
export function createComment(postId: string, data: CreateCommentPayload) {
  return api.post<{ commentId: string; rootCommentId: string | null; message: string }>(
    `/forum/posts/${encodeURIComponent(postId)}/comments`,
    data,
  );
}

export function deleteComment(commentId: string) {
  return api.delete<{ message: string }>(`/forum/comments/${encodeURIComponent(commentId)}`);
}

// Comment likes
export function likeComment(commentId: string) {
  return api.post<{ liked: boolean; likeCount: number; message: string }>(
    `/forum/comments/${encodeURIComponent(commentId)}/like`,
    {},
  );
}

export function unlikeComment(commentId: string) {
  return api.delete<{ liked: boolean; likeCount: number; message: string }>(
    `/forum/comments/${encodeURIComponent(commentId)}/like`,
  );
}

export function requestTranscript(commentId: string) {
  return api.post<{ message: string; transcriptStatus: string }>(
    `/forum/comments/${encodeURIComponent(commentId)}/transcript`,
    {},
  );
}

// Comment Replies (two-level)
export function getCommentReplies(
  rootCommentId: string,
  page: number = 1,
  limit: number = 50,
) {
  const sp = new URLSearchParams();
  sp.set('page', String(page));
  sp.set('limit', String(limit));
  return api.get<CommentRepliesResponse>(
    `/forum/comments/${encodeURIComponent(rootCommentId)}/replies?${sp.toString()}`,
  );
}

// Hot Ranking
export function getHotRanking(params: {
  range?: HotRankingRange;
  limit?: number;
}) {
  const sp = new URLSearchParams();
  if (params.range) sp.set('range', params.range);
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return api.get<HotRankingItem[]>(`/forum/ranking/hot${qs ? `?${qs}` : ''}`);
}

// Announcements
export function getAnnouncements() {
  return api.get<AnnouncementItem[]>('/forum/announcements');
}

export function getAnnouncementDetail(id: string) {
  return api.get<AnnouncementDetail>(`/forum/announcements/${encodeURIComponent(id)}`);
}

// Guestbook
export function getGuestbookMessages(params: { page?: number; limit?: number }) {
  const sp = new URLSearchParams();
  if (params.page) sp.set('page', String(params.page));
  if (params.limit) sp.set('limit', String(params.limit));
  const qs = sp.toString();
  return api.get<GuestbookListResponse>(`/forum/guestbook/messages${qs ? `?${qs}` : ''}`);
}

export function createGuestbookMessage(content: string) {
  return api.post<{ messageId: string; message: string }>('/forum/guestbook/messages', { content });
}

export function deleteGuestbookMessage(messageId: string) {
  return api.delete<{ message: string }>(`/forum/guestbook/messages/${encodeURIComponent(messageId)}`);
}

export function submitForumReport(payload: {
  targetType: 'post' | 'comment' | 'user';
  postId?: string;
  commentId?: string;
  reportedUserId?: string;
  reasons: ForumReportReason[];
  detail?: string;
}) {
  return api.post<{ reportId: string; status: 'pending'; message: string }>('/forum/reports', payload);
}

export function dismissMyMessage(messageId: string) {
  return api.delete<{ message: string }>(`/forum/me/messages/${encodeURIComponent(messageId)}`);
}

export async function dismissMessage(messageId: string): Promise<void> {
  await dismissMyMessage(messageId);
}

// ─── Users ──────────────────────────────────────────────────────

export interface UserPublicProfile {
  nickname: string;
  avatarUrl: string | null;
  signature: string | null;
  tags: string[];
  postCount: number;
  likeCount: number;
}

export async function getUserPublicProfile(userId: string): Promise<UserPublicProfile> {
  return api.get<UserPublicProfile>(`/forum/users/${encodeURIComponent(userId)}/profile`);
}

export async function getUserPublicPosts(userId: string, page = 1, limit = 20): Promise<PostListResponse> {
  const qs = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  }).toString();
  return api.get<PostListResponse>(`/forum/users/${encodeURIComponent(userId)}/posts?${qs}`);
}
