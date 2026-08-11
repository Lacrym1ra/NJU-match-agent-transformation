import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { TYPE_INFO, STORAGE_KEY_RESULT, PersonalityResult } from '../lib/personalityConfig';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { getUserStats, pauseWeek, updateSignature, updateTags, UserStats } from '../api/user';
import { getHeartboxMe, HeartboxMeResponse } from '../api/heartbox';
import MaterialIcon from '../components/MaterialIcon';
import {
  getCurrentMatch,
  getMatchHistory,
  getMatchResult,
  CurrentMatchResponse,
  MatchHistoryItem,
  MatchResultResponse,
} from '../api/match';
import { getFriendCard } from '../api/card';
import { getQuestions, getAnswers } from '../api/survey';
import {
  approveContactUnlockRequest,
  CircleContact,
  ContactUnlockInboxItem,
  ContactUnlockReplyItem,
  getCircleContacts,
  getContactUnlockRequests,
  getUnlockedContacts,
  rejectContactUnlockRequest,
  revokeContactUnlockRequest,
  sendContactUnlockRequest,
} from '../api/contacts';
import {
  Circle,
  ChannelMember,
  getChannelMembers,
  getMyCircles,
} from '../api/circles';
import { 
  AcceptedFriendRequest,
  GroupedFriend,
  sendFriendRequest, 
  getGroupedFriends,
  deleteFriendEverywhere,
  getPendingRequests, 
  acceptFriendRequest, 
  rejectFriendRequest, 
  FriendRequest 
} from '../api/friends';
import {
  Application,
  getApplications as getTeamUpApplications,
  getMyTeamUpApplicationReplies,
  getTeamUps,
  reviewApplication as reviewTeamUpApplication,
  TeamUpApplicationReply,
} from '../api/teamups';
import { CHANGELOG_NOTICE } from './Changelog';
import Announcement from '../components/Announcement';
import UpdateModal from '../components/UpdateModal';
import AddressBookFriendDetailModal from '../components/AddressBookFriendDetailModal';
import CardSnapshotModal from '../components/CardSnapshotModal';
import { useToast } from '../components/Toast';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { CardSnapshotPreview } from '../api/cardSnapshots';
import { copyText } from '../lib/copyText';
import { uniqueCircleContacts } from '../modules/contacts/circleContacts';
import { teamupApplicationSnapshotToPreview } from '../modules/teamups/snapshots';
import { blockUser, getBlockStatus, reportUser, ReportReason, unblockUser } from '../api/safety';
import {
  getMyPosts,
  getLikedPosts,
  getFavoritedPosts,
  getMyMessages,
  dismissMyMessage,
  markMessageRead,
  MyForumMessageItem,
  PostListItem,
} from '../api/forum';
import { DirectMessageConversationSummary, getFollowList, listDirectMessageConversations } from '../api/social';
import { ForumPostDetail } from './ForumPost';
const CHANGELOG_SEEN_KEY = 'nj_changelog_seen';
const INBOX_REPLY_SEEN_KEY = 'nj_inbox_reply_seen';
type ReplySectionKey = 'friend' | 'contact' | 'teamup';
type ProfileSubTab = 'mine' | 'liked' | 'favorites' | 'notifications' | 'directMessages';

// 下一个即将到来的周三（与后端 getUpcomingWeekOf 一致）
function getUpcomingWeekOf(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = shifted.getUTCDay();
  const hour = shifted.getUTCHours();
  let diff = day <= 3 ? 3 - day : 10 - day;
  if (day === 3 && hour >= 20) {
    diff = 7;
  }
  const wed = new Date(shifted.getTime());
  wed.setUTCDate(shifted.getUTCDate() + diff);
  const yyyy = wed.getUTCFullYear();
  const mm = String(wed.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(wed.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 判断当前是否处于匹配锁定期间（北京时间周三 18:00 - 20:00）
function getIsMatchingLocked(): boolean {
  const now = new Date();
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const day = shifted.getUTCDay();
  const hour = shifted.getUTCHours();
  return day === 3 && hour >= 18 && hour < 20;
}

// 信封堆叠动画变体（保留原有设计）
const envelopeVariants = {
  idle: (i: number) => ({
    y: i * 8,
    x: [0, 6, -4][i % 3],
    rotate: [-4, 5, -2][i % 3],
    scale: 1,
    zIndex: 10 - i,
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 }
  }),
  hover: (i: number) => ({
    y: i * 14 - 15,
    x: i % 2 === 0 ? i * 10 : i * -10,
    rotate: [-5, 7, -3][i % 3],
    scale: 1.02,
    zIndex: 10 - i,
    transition: { type: 'spring' as const, stiffness: 300, damping: 25 }
  })
};

// 计算距离目标时间的剩余秒数
function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function timeValue(value?: string | null): number {
  const time = Date.parse(value ?? '');
  return Number.isFinite(time) ? time : 0;
}

function sortMessages(messages: MyForumMessageItem[]) {
  return [...messages].sort((a, b) => {
    if (a.isRead !== b.isRead) {
      return a.isRead ? 1 : -1;
    }

    return timeValue(b.createdAt) - timeValue(a.createdAt);
  });
}

function resolveDirectMessagePartnerUserId(
  conversation: DirectMessageConversationSummary,
  viewerUserId?: string | null,
) {
  const participant = viewerUserId
    ? [conversation.userA, conversation.userB].find((item) => item?.userId && item.userId !== viewerUserId)
    : null;
  if (participant?.userId) {
    return participant.userId;
  }

  if (conversation.partner.userId && conversation.partner.userId !== viewerUserId) {
    return conversation.partner.userId;
  }

  const lastMessage = conversation.lastMessage;
  if (!lastMessage || !viewerUserId) {
    return conversation.partner.userId;
  }

  if (lastMessage.senderId === viewerUserId) {
    return lastMessage.receiverId;
  }

  if (lastMessage.receiverId === viewerUserId) {
    return lastMessage.senderId;
  }

  return conversation.partner.userId;
}

function getDirectMessagePartnerName(
  conversation: DirectMessageConversationSummary,
  viewerUserId?: string | null,
) {
  const participant = viewerUserId
    ? [conversation.userA, conversation.userB].find((item) => item?.userId && item.userId !== viewerUserId)
    : null;
  if (participant) {
    return participant.nickname || '未命名用户';
  }

  if (conversation.partner.userId && conversation.partner.userId !== viewerUserId) {
    return conversation.partner.nickname || '未命名用户';
  }

  return conversation.partner.nickname || '未命名用户';
}

function getDirectMessagePreview(conversation: DirectMessageConversationSummary) {
  const message = conversation.lastMessage;
  if (!message) return '点击查看这条私信';
  if (message.recalledAt) return '[已撤回]';
  if (message.messageType === 'image') return '[图片]';
  if (message.messageType === 'voice') return `[语音 ${message.voiceDurationSec ?? '?'}s]`;
  return message.content || '点击查看这条私信';
}

const statLabelIconStyle: React.CSSProperties = {
  fontVariationSettings: "'FILL' 0, 'wght' 120, 'GRAD' 0, 'opsz' 20",
};

function secondsToDisplay(totalSec: number) {
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

// 将历史记录状态映射为中文印章文字
function statusLabel(status: string): string {
  switch (status) {
    case 'MUTUAL': return '愿见';
    case 'MISSED': return '止步';
    case 'EXPIRED': return '错过';
    case 'NO_MATCH': return '无缘';
    default: return '未知';
  }
}

// 将 weekOf 格式化为显示字符串
function formatWeekOf(weekOf: string): string {
  const d = new Date(weekOf);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} 期`;
}

function normalizeLookupText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/·:：()（）【】[\]'"`]+/g, '');
}

function getMemberHint(member: ChannelMember) {
  const tags = Array.isArray(member.channelTags)
    ? member.channelTags
        .slice(0, 2)
        .map((tag: { label?: string; value?: string }) => [tag.label, tag.value].filter(Boolean).join(' '))
        .filter(Boolean)
    : [];
  const suffix = `识别尾号 ${String(member.userId || '').replace(/-/g, '').slice(-4).toUpperCase() || '未知'}`;
  return tags.length > 0 ? `${tags.join(' · ')} · ${suffix}` : suffix;
}

type AddressBookEntry = GroupedFriend;

type TeamUpApplicationInboxItem = Application & {
  circleId: string;
  circleName: string;
  teamupTitle: string;
};

type AddressBookFriendDetail = {
  contacts: Awaited<ReturnType<typeof getUnlockedContacts>>['contacts'];
  baseModules: Array<{
    moduleKey: string;
    label: string;
    value: string;
  }>;
  circleCards: Array<{
    circleId: string;
    circleName: string;
    friendSince: string;
    modules: Array<{
      key: string;
      label: string;
      value: string;
    }>;
  }>;
};

function getContactPlatformLabel(platform?: string): string {
  if (platform === 'qq') return 'QQ';
  if (platform === 'xiaohongshu') return '小红书';
  return '微信';
}

function getContactUnlockSourceLabel(item: {
  source_label?: string;
  circle_name?: string;
  circle_id?: string;
  source_type: 'circle' | 'address_book';
}) {
  return item.source_label || item.circle_name || (item.source_type === 'address_book' ? '同窗名录' : item.circle_id || '未知');
}

function statusPillClass(tone: 'success' | 'muted' | 'warning' | 'danger') {
  switch (tone) {
    case 'success':
      return 'border-[#420047]/20 bg-[#420047]/5 text-[#420047]';
    case 'warning':
      return 'border-[#C4842F]/25 bg-[#FFF7E8] text-[#9B641A]';
    case 'danger':
      return 'border-[#B94A48]/25 bg-[#FFF4F4] text-[#B94A48]';
    default:
      return 'border-[#D7D1C8] bg-[#F3F1ED] text-[#8B7355]';
  }
}

function getFriendReplyStatusView(status: AcceptedFriendRequest['status'], sourceLabel: string) {
  switch (status) {
    case 'accepted':
      return {
        label: '已通过',
        tone: 'success' as const,
        icon: 'check_circle',
        text: `已在 ${sourceLabel} 接纳你的交际申请`,
        canOpenCard: true,
      };
    case 'rejected':
      return {
        label: '已拒绝',
        tone: 'muted' as const,
        icon: 'block',
        text: `已在 ${sourceLabel} 婉拒你的交际申请`,
        canOpenCard: false,
      };
    case 'withdrawn':
      return {
        label: '已撤回',
        tone: 'muted' as const,
        icon: 'undo',
        text: `你已撤回在 ${sourceLabel} 的交际申请`,
        canOpenCard: false,
      };
    case 'expired':
      return {
        label: '已过期',
        tone: 'warning' as const,
        icon: 'schedule',
        text: `你在 ${sourceLabel} 的交际申请已过期`,
        canOpenCard: false,
      };
    default:
      return {
        label: '状态未知',
        tone: 'muted' as const,
        icon: 'help',
        text: `你在 ${sourceLabel} 的交际申请状态已更新`,
        canOpenCard: false,
      };
  }
}

function getContactReplyStatusView(status: ContactUnlockReplyItem['status'], sourceLabel: string) {
  switch (status) {
    case 'approved':
      return {
        label: '已同意',
        tone: 'success' as const,
        icon: 'mark_email_read',
        text: `已同意与你交换联系方式 · ${sourceLabel}`,
        canViewContacts: true,
        canRequestMore: true,
      };
    case 'rejected':
      return {
        label: '已拒绝',
        tone: 'muted' as const,
        icon: 'mail_lock',
        text: `暂未同意与你交换联系方式 · ${sourceLabel}`,
        canViewContacts: false,
        canRequestMore: false,
      };
    case 'withdrawn':
      return {
        label: '已撤回',
        tone: 'muted' as const,
        icon: 'undo',
        text: `你已撤回这次联系方式申请 · ${sourceLabel}`,
        canViewContacts: false,
        canRequestMore: false,
      };
    case 'expired':
      return {
        label: '已过期',
        tone: 'warning' as const,
        icon: 'schedule',
        text: `这次联系方式申请已过期 · ${sourceLabel}`,
        canViewContacts: false,
        canRequestMore: false,
      };
    case 'revoked':
      return {
        label: '已撤销',
        tone: 'danger' as const,
        icon: 'lock_reset',
        text: `对方已撤销这次联系方式授权 · ${sourceLabel}`,
        canViewContacts: false,
        canRequestMore: false,
      };
    default:
      return {
        label: '状态未知',
        tone: 'muted' as const,
        icon: 'help',
        text: `这次联系方式申请状态已更新 · ${sourceLabel}`,
        canViewContacts: false,
        canRequestMore: false,
      };
  }
}

function historyNote(status: MatchHistoryItem['status']) {
  switch (status) {
    case 'MUTUAL':
      return '这一页已被双方翻开，若联系方式仍在，故事便还能续写。';
    case 'MISSED':
      return '你们都曾驻足此页，只是缘分最后停在了合上信笺之前。';
    case 'EXPIRED':
      return '这枚书签已经泛黄，旧时光留在了那一期的落叶里。';
    case 'NO_MATCH':
      return '这一期书信未曾送达，缘分尚未翻到这页。';
    default:
      return '这页档案暂时没有更多可翻阅的内容。';
  }
}

const REPORT_REASON_OPTIONS: Array<{ value: ReportReason; label: string }> = [
  { value: 'harassment', label: '骚扰辱骂' },
  { value: 'spam', label: '垃圾信息' },
  { value: 'fake_profile', label: '虚假资料' },
  { value: 'inappropriate_content', label: '不当内容' },
  { value: 'other', label: '其他原因' },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { error: toastError, success: toastSuccess, warning: toastWarning } = useToast();
  const { confirm, confirmDialog } = useConfirmDialog();

  const [activeTab, setActiveTab] = useState<'MATCH' | 'CIRCLE' | 'PROFILE'>(() => {
    try {
      const saved = sessionStorage.getItem('nj_dashboard_tab');
      return (saved === 'MATCH' || saved === 'CIRCLE' || saved === 'PROFILE') ? saved : 'MATCH';
    } catch {
      return 'MATCH';
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem('nj_dashboard_tab', activeTab);
    } catch {}
  }, [activeTab]);

  const [matchData, setMatchData] = useState<CurrentMatchResponse | null>(null);
  const [heartboxData, setHeartboxData] = useState<HeartboxMeResponse | null>(null);
  const [history, setHistory] = useState<MatchHistoryItem[]>([]);
  const [isLoadingMatch, setIsLoadingMatch] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [isStackHovered, setIsStackHovered] = useState(false);
  const [isArchiveDrawerOpen, setIsArchiveDrawerOpen] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<MatchHistoryItem | null>(null);
  const [selectedHistoryResult, setSelectedHistoryResult] = useState<MatchResultResponse | null>(null);
  const [isHistoryDetailLoading, setIsHistoryDetailLoading] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [surveyOutdated, setSurveyOutdated] = useState(false);
  const [surveyBannerDismissed, setSurveyBannerDismissed] = useState(false);
  const [savedPersonality, setSavedPersonality] = useState<PersonalityResult | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_RESULT);
      return raw ? (JSON.parse(raw) as PersonalityResult) : null;
    } catch { return null; }
  });
  const [showChangelogBadge, setShowChangelogBadge] = useState(false);

  // 好友系统相关状态
  const [isFriendDrawerOpen, setIsFriendDrawerOpen] = useState(false);
  const [isContactsDrawerOpen, setIsContactsDrawerOpen] = useState(false);

  // 好友功能状态
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [acceptedFriendRequests, setAcceptedFriendRequests] = useState<AcceptedFriendRequest[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [contactUnlockRequests, setContactUnlockRequests] = useState<ContactUnlockInboxItem[]>([]);
  const [contactUnlockReplies, setContactUnlockReplies] = useState<ContactUnlockReplyItem[]>([]);
  const [loadingContactUnlockRequests, setLoadingContactUnlockRequests] = useState(false);
  const [approvingContactRequest, setApprovingContactRequest] = useState<ContactUnlockInboxItem | null>(null);
  const [circleContactOptions, setCircleContactOptions] = useState<CircleContact[]>([]);
  const [selectedCircleContactIds, setSelectedCircleContactIds] = useState<string[]>([]);
  const [loadingCircleContactOptions, setLoadingCircleContactOptions] = useState(false);
  const [submittingCircleContactApproval, setSubmittingCircleContactApproval] = useState(false);
  const [requestingMoreContactReplyId, setRequestingMoreContactReplyId] = useState<string | null>(null);
  const [teamUpApplicationRequests, setTeamUpApplicationRequests] = useState<TeamUpApplicationInboxItem[]>([]);
  const [teamUpApplicationReplies, setTeamUpApplicationReplies] = useState<TeamUpApplicationReply[]>([]);
  const [loadingTeamUpApplications, setLoadingTeamUpApplications] = useState(false);
  const [expandedReplySections, setExpandedReplySections] = useState<Record<ReplySectionKey, boolean>>({
    friend: false,
    contact: false,
    teamup: false,
  });
  const [seenReplyIds, setSeenReplyIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(INBOX_REPLY_SEEN_KEY) || '[]'));
    } catch {
      return new Set();
    }
  });
  const [reviewingTeamUpApplicationId, setReviewingTeamUpApplicationId] = useState<string | null>(null);
  const [addressBookEntries, setAddressBookEntries] = useState<AddressBookEntry[]>([]);
  const [loadingAddressBook, setLoadingAddressBook] = useState(false);
  const [contactsOnlyFilter, setContactsOnlyFilter] = useState(false);
  const [selectedAddressBookFriend, setSelectedAddressBookFriend] = useState<AddressBookEntry | null>(null);
  const [addressBookDetail, setAddressBookDetail] = useState<AddressBookFriendDetail | null>(null);
  const [loadingAddressBookDetail, setLoadingAddressBookDetail] = useState(false);
  const [addressBookDetailError, setAddressBookDetailError] = useState<string | null>(null);
  const [requestingAddressBookContact, setRequestingAddressBookContact] = useState(false);
  const [removingAddressBookFriend, setRemovingAddressBookFriend] = useState(false);
  const [revokingContactRequestId, setRevokingContactRequestId] = useState<string | null>(null);
  const [isBlockedAddressBookFriend, setIsBlockedAddressBookFriend] = useState(false);
  const [isBlockingAddressBookFriend, setIsBlockingAddressBookFriend] = useState(false);
  const [isBlockedArchivePartner, setIsBlockedArchivePartner] = useState(false);
  const [isBlockingArchivePartner, setIsBlockingArchivePartner] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReasons, setReportReasons] = useState<ReportReason[]>([]);
  const [reportDetail, setReportDetail] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [activeSnapshot, setActiveSnapshot] = useState<{
    title: string;
    subtitle?: string;
    snapshot: CardSnapshotPreview;
  } | null>(null);
  const [userStats, setUserStats] = useState<UserStats>({
    creditScore: user?.creditScore ?? 100,
    receivedLikes: 0,
    receivedFavorites: 0,
  });
  const [forumSummary, setForumSummary] = useState({ mine: 0, liked: 0, favorites: 0, messages: 0 });
  const [followSummary, setFollowSummary] = useState({ followingCount: 0, followerCount: 0, mutualCount: 0 });
  const [myPostsList, setMyPostsList] = useState<PostListItem[]>([]);
  const [likedPostsList, setLikedPostsList] = useState<PostListItem[]>([]);
  const [favoritedPostsList, setFavoritedPostsList] = useState<PostListItem[]>([]);
  const [messagesList, setMessagesList] = useState<MyForumMessageItem[]>([]);
  const [selectedDashboardForumPostId, setSelectedDashboardForumPostId] = useState<string | null>(null);
  const [signatureDraft, setSignatureDraft] = useState('');
  const [tagDraft, setTagDraft] = useState<string[]>([]);

  // 消息中心（站内通知）相关状态
  const { unreadCount: notifUnreadCount } = useNotification();
  const [isEditingSignature, setIsEditingSignature] = useState(false);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [savingProfileEnhancement, setSavingProfileEnhancement] = useState(false);
  const [profileSubTab, setProfileSubTab] = useState<ProfileSubTab>(() => {
    try {
      const saved = sessionStorage.getItem('nj_dashboard_profile_subtab');
      if (saved === 'mine' || saved === 'liked' || saved === 'favorites' || saved === 'notifications' || saved === 'directMessages') {
        return saved;
      }
      return saved === 'messages' ? 'notifications' : 'mine';
    } catch {
      return 'mine';
    }
  });
  const [friendCircleQuery, setFriendCircleQuery] = useState('');
  const [selectedFriendCircle, setSelectedFriendCircle] = useState<Circle | null>(null);
  const [joinedCircles, setJoinedCircles] = useState<Circle[]>([]);
  const [loadingJoinedCircles, setLoadingJoinedCircles] = useState(false);
  const [circleMembers, setCircleMembers] = useState<ChannelMember[]>([]);
  const [loadingCircleMembers, setLoadingCircleMembers] = useState(false);
  const [friendTargetQuery, setFriendTargetQuery] = useState('');
  const [selectedFriendTarget, setSelectedFriendTarget] = useState<ChannelMember | null>(null);
  const [friendMessage, setFriendMessage] = useState('');
  const [sendingFriend, setSendingFriend] = useState(false);
  const [directMessageConversations, setDirectMessageConversations] = useState<DirectMessageConversationSummary[]>([]);
  const addressBookDetailRequestRef = useRef(0);
  const countdownRef = useRef(0);
  const friendCircleMembersRequestRef = useRef(0);
  const unreadForumMessageCount = messagesList.filter((message) => !message.isRead).length;
  const unreadDirectMessageCount = directMessageConversations.reduce((sum, conversation) => sum + conversation.unreadCount, 0);

  useEffect(() => {
    setShowChangelogBadge(localStorage.getItem(CHANGELOG_SEEN_KEY) !== CHANGELOG_NOTICE.version);
  }, []);

  useEffect(() => {
    setSignatureDraft(user?.signature ?? '');
    setTagDraft(user?.tags ?? []);
    setNewTagInput('');
    setIsEditingSignature(false);
    setIsAddingTag(false);
  }, [user]);

  useEffect(() => {
    try {
      sessionStorage.setItem('nj_dashboard_profile_subtab', profileSubTab);
    } catch {}
  }, [profileSubTab]);

  useEffect(() => {
    setUserStats((prev) => ({
      ...prev,
      creditScore: user?.creditScore ?? 100,
    }));
  }, [user?.creditScore]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const stats = await getUserStats();
        if (cancelled) return;

        setUserStats({
          ...stats,
          creditScore: user?.creditScore ?? stats.creditScore,
        });
      } catch (err) {
        console.warn('加载个人主页统计失败', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.creditScore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
       const [mine, liked, favorites, messages, directMessages] = await Promise.all([
          getMyPosts({ page: 1, limit: 5 }),
          getLikedPosts({ page: 1, limit: 5 }),
          getFavoritedPosts({ page: 1, limit: 5 }),
          getMyMessages({ page: 1, limit: 5 }),
          listDirectMessageConversations(),
        ]);
        
        if (cancelled) return;
        
        setForumSummary({
          mine: mine.total,
          liked: liked.total,
          favorites: favorites.total,
          messages: messages.total,
        });
        setMyPostsList(mine.posts || []);
        setLikedPostsList(liked.posts || []);
        setFavoritedPostsList(favorites.posts || []);
        setMessagesList(sortMessages(messages.messages || []));
        setDirectMessageConversations(directMessages.conversations || []);
      } catch (err) {
        console.warn('加载论坛聚合数据失败', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getFollowList('mutual');
        if (cancelled) return;
        setFollowSummary({
          followingCount: result.followingCount,
          followerCount: result.followerCount,
          mutualCount: result.mutualCount,
        });
      } catch (err) {
        console.warn('鍔犺浇鍏虫敞鏁版嵁澶辫触', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleOpenDashboardForumPost = useCallback((postId: string | null | undefined) => {
    if (!postId) return;
    setSelectedDashboardForumPostId(postId);
  }, []);

  const handleCloseDashboardForumPost = useCallback(() => {
    setSelectedDashboardForumPostId(null);
  }, []);

  const handleOpenMessage = useCallback(async (message: MyForumMessageItem) => {
    try {
      if (!message.isRead) {
        await markMessageRead(message.messageId);
        setMessagesList((prev) =>
          sortMessages(
            prev.map((item) =>
              item.messageId === message.messageId ? { ...item, isRead: true } : item,
            ),
          ),
        );
      }
    } catch (err) {
      console.warn('标记消息已读失败', err);
    } finally {
      if (message.postId) {
        handleOpenDashboardForumPost(message.postId);
      }
    }
  }, [handleOpenDashboardForumPost]);

  const handleOpenDirectMessage = useCallback((conversation: DirectMessageConversationSummary) => {
    const partnerUserId = resolveDirectMessagePartnerUserId(conversation, user?.id);
    if (!partnerUserId) {
      toastError('私信会话数据异常，请刷新后重试');
      return;
    }

    setDirectMessageConversations((prev) =>
      prev.map((item) => (
        item.conversationId === conversation.conversationId
          ? { ...item, unreadCount: 0 }
          : item
      )),
    );
    navigate(`/messages/${partnerUserId}`);
  }, [navigate, toastError, user?.id]);

  // 计算下一周三晚上 8 点距离现在的秒数
  const getSecondsToNextWed8PM = useCallback(() => {
    const now = new Date();
    const nowMs = now.getTime();
    
    // 转为北京时间计算日期与小时
    const bj = new Date(nowMs + now.getTimezoneOffset() * 60000 + 8 * 3600000);
    const day = bj.getDay();

    let daysToWed = (3 - day + 7) % 7;
    // 如果今天（或几天后）是周三，且已过晚8点，则推算到下周三
    if (daysToWed === 0 && bj.getHours() >= 20) {
      daysToWed = 7;
    }

    // 构建目标北京时间的 UTC 时间戳 (北京时间 20:00 等于 UTC 12:00)
    const targetMs = Date.UTC(bj.getFullYear(), bj.getMonth(), bj.getDate() + daysToWed, 12, 0, 0, 0);
    return Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  }, []);

  const loadHeartbox = useCallback(async () => {
    try {
      const res = await getHeartboxMe();
      setHeartboxData(res);
    } catch (err) {
      console.error('Failed to load heartbox', err);
    }
  }, []);

  // 加载本周匹配状态
  const loadMatch = useCallback(async () => {
    try {
      const res = await getCurrentMatch();
      const nextCountdown = getSecondsToNextWed8PM();
      setMatchData(res);
      countdownRef.current = nextCountdown;
      setCountdown(nextCountdown);
    } catch {
      toastError('加载匹配状态失败，请刷新页面重试');
    } finally {
      setIsLoadingMatch(false);
    }
  }, [getSecondsToNextWed8PM, toastError]);

  const syncCountdown = useCallback(() => {
    const previous = countdownRef.current;
    const next = getSecondsToNextWed8PM();

    countdownRef.current = next;
    setCountdown(next);

    // When the countdown rolls over to the next Wednesday window, refresh match state once.
    if (previous > 0 && next > previous) {
      void loadMatch();
    }
  }, [getSecondsToNextWed8PM, loadMatch]);

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    try {
      const res = await getMatchHistory(1, 10);
      setHistory(res.matches);
    } catch {
            // 历史记录不是核心功能，静默忽略
    }
  }, []);

  // 加载好友申请列表 (静默加载以显示红点)
  const loadFriendRequests = useCallback(async () => {
    setLoadingFriends(true);
    try {
      const res = await getPendingRequests();
      const data = (res as any).data || res;
      setFriendRequests(data.requests || []);
      setAcceptedFriendRequests(data.acceptedRequests || []);
    } catch (err) {
      console.error('加载好友申请失败', err);
    } finally {
      setLoadingFriends(false);
    }
  }, []);

  const loadContactUnlockRequests = useCallback(async () => {
    setLoadingContactUnlockRequests(true);
    try {
      const res = await getContactUnlockRequests();
      setContactUnlockRequests(res.requests || []);
      setContactUnlockReplies(res.replies || []);
    } catch (err) {
      console.error('加载联系方式申请失败', err);
    } finally {
      setLoadingContactUnlockRequests(false);
    }
  }, []);

  const loadTeamUpApplications = useCallback(async () => {
    setLoadingTeamUpApplications(true);
    try {
      const [circlesRes, repliesRes] = await Promise.all([
        getMyCircles(),
        getMyTeamUpApplicationReplies(),
      ]);
      setTeamUpApplicationReplies(repliesRes.replies || []);

      const joinedCircles = (circlesRes.circles || []).filter((circle) => (
        circle.membershipStatus ? circle.membershipStatus === 'active' : circle.isJoined !== false
      ));

      const circleResults = await Promise.allSettled(
        joinedCircles.map(async (circle) => {
          const teamupsRes = await getTeamUps(circle.id, 'created');
          const reviewableTeamups = (teamupsRes.teamups || []).filter((teamup) => (
            teamup.joinMode === 'approval'
            && teamup.effectiveStatus !== 'cancelled'
            && teamup.effectiveStatus !== 'ended'
          ));

          const applicationResults = await Promise.allSettled(
            reviewableTeamups.map(async (teamup) => {
              const applicationRes = await getTeamUpApplications(circle.id, teamup.id, 'pending');
              return (applicationRes.applications || []).map((application) => ({
                ...application,
                circleId: circle.id,
                circleName: circle.name,
                teamupTitle: teamup.title,
              }));
            }),
          );

          return applicationResults.flatMap((result) => (
            result.status === 'fulfilled' ? result.value : []
          ));
        }),
      );

      setTeamUpApplicationRequests(circleResults.flatMap((result) => (
        result.status === 'fulfilled' ? result.value : []
      )));
    } catch (err) {
      console.error('加载组队申请失败', err);
    } finally {
      setLoadingTeamUpApplications(false);
    }
  }, []);

  const loadAddressBook = useCallback(async () => {
    setLoadingAddressBook(true);
    try {
      const res = await getGroupedFriends();
      setAddressBookEntries(res.friends || []);
    } catch (err) {
      console.error('加载同窗名录失败', err);
      toastError('加载同窗名录失败，请稍后重试');
    } finally {
      setLoadingAddressBook(false);
    }
  }, [toastError]);

  const loadJoinedCircles = useCallback(async () => {
    setLoadingJoinedCircles(true);
    try {
      const res = await getMyCircles();
      setJoinedCircles(res.circles || []);
    } catch (err) {
      console.error('加载已加入圈子失败', err);
      toastError('加载圈子列表失败，请稍后再试');
    } finally {
      setLoadingJoinedCircles(false);
    }
  }, [toastError]);

  const loadMembersForCircle = useCallback(async (circle: Circle) => {
    const requestId = friendCircleMembersRequestRef.current + 1;
    friendCircleMembersRequestRef.current = requestId;
    setLoadingCircleMembers(true);

    try {
      const firstPage = await getChannelMembers(circle.id, 1, 50);
      let members = firstPage.members || [];
      const totalPages = Math.max(1, Math.ceil((firstPage.total || members.length) / 50));

      if (totalPages > 1) {
        const restPages = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) => getChannelMembers(circle.id, index + 2, 50)),
        );
        members = [
          ...members,
          ...restPages.flatMap((pageResult) => pageResult.members || []),
        ];
      }

      if (friendCircleMembersRequestRef.current !== requestId) return;

      const uniqueMembers = members.filter((member, index, allMembers) => (
        allMembers.findIndex((candidate) => candidate.userId === member.userId) === index
      ));

      setCircleMembers(uniqueMembers.filter((member) => member.userId !== user?.id));
    } catch (err) {
      if (friendCircleMembersRequestRef.current !== requestId) return;
      console.error('加载圈内同窗失败', err);
      setCircleMembers([]);
      toastError('加载圈内同窗失败，请稍后再试');
    } finally {
      if (friendCircleMembersRequestRef.current === requestId) {
        setLoadingCircleMembers(false);
      }
    }
  }, [toastError, user?.id]);

  const handleSelectFriendCircle = useCallback((circle: Circle) => {
    setSelectedFriendCircle(circle);
    setFriendCircleQuery(circle.name);
    setFriendTargetQuery('');
    setSelectedFriendTarget(null);
  }, []);

  const handleSelectFriendTarget = useCallback((member: ChannelMember) => {
    setSelectedFriendTarget(member);
    setFriendTargetQuery(member.nickname || '');
  }, []);

  const normalizedCircleQuery = useMemo(() => normalizeLookupText(friendCircleQuery), [friendCircleQuery]);

  const matchedCircles = useMemo(() => {
    if (!normalizedCircleQuery) return [];

    return joinedCircles.filter((circle) => {
      const normalizedName = normalizeLookupText(circle.name || '');
      const normalizedSlug = normalizeLookupText(circle.slug || '');
      return normalizedName.includes(normalizedCircleQuery) || normalizedSlug.includes(normalizedCircleQuery);
    });
  }, [joinedCircles, normalizedCircleQuery]);

  const exactCircleMatches = useMemo(() => (
    matchedCircles.filter((circle) => {
      const normalizedName = normalizeLookupText(circle.name || '');
      const normalizedSlug = normalizeLookupText(circle.slug || '');
      return normalizedName === normalizedCircleQuery || normalizedSlug === normalizedCircleQuery;
    })
  ), [matchedCircles, normalizedCircleQuery]);

  const normalizedTargetQuery = useMemo(() => normalizeLookupText(friendTargetQuery), [friendTargetQuery]);

  const matchedMembers = useMemo(() => {
    if (!selectedFriendCircle || !normalizedTargetQuery) return [];

    return circleMembers.filter((member) => (
      normalizeLookupText(member.nickname || '').includes(normalizedTargetQuery)
    ));
  }, [circleMembers, normalizedTargetQuery, selectedFriendCircle]);

  const exactTargetMatches = useMemo(() => (
    matchedMembers.filter((member) => normalizeLookupText(member.nickname || '') === normalizedTargetQuery)
  ), [matchedMembers, normalizedTargetQuery]);

  useEffect(() => {
    loadMatch();
    loadHeartbox();
    loadHistory();
    loadFriendRequests();
    loadContactUnlockRequests();
    loadTeamUpApplications();
  }, [loadMatch, loadHistory, loadFriendRequests, loadContactUnlockRequests, loadTeamUpApplications]);

  useEffect(() => {
    if (!isFriendDrawerOpen) return;
    void loadFriendRequests();
    void loadContactUnlockRequests();
    void loadTeamUpApplications();
  }, [isFriendDrawerOpen, loadFriendRequests, loadContactUnlockRequests, loadTeamUpApplications]);

  useEffect(() => {
    if (!isContactsDrawerOpen) return;
    void loadAddressBook();
  }, [isContactsDrawerOpen, loadAddressBook]);

  useEffect(() => {
    if (!isFriendDrawerOpen) return;
    void loadJoinedCircles();
  }, [isFriendDrawerOpen, loadJoinedCircles]);

  useEffect(() => {
    if (!isFriendDrawerOpen) {
      friendCircleMembersRequestRef.current += 1;
      setLoadingCircleMembers(false);
      return;
    }

    if (!normalizedCircleQuery) {
      setSelectedFriendCircle(null);
      setCircleMembers([]);
      setFriendTargetQuery('');
      setSelectedFriendTarget(null);
      setLoadingCircleMembers(false);
      return;
    }

    if (exactCircleMatches.length === 1) {
      const nextCircle = exactCircleMatches[0];
      if (selectedFriendCircle?.id !== nextCircle.id) {
        setSelectedFriendCircle(nextCircle);
        setFriendTargetQuery('');
        setSelectedFriendTarget(null);
      }
      if (friendCircleQuery !== nextCircle.name) {
        setFriendCircleQuery(nextCircle.name);
      }
      return;
    }

    if (
      selectedFriendCircle &&
      normalizeLookupText(selectedFriendCircle.name || '') !== normalizedCircleQuery &&
      normalizeLookupText(selectedFriendCircle.slug || '') !== normalizedCircleQuery
    ) {
      setSelectedFriendCircle(null);
      setCircleMembers([]);
      setFriendTargetQuery('');
      setSelectedFriendTarget(null);
      setLoadingCircleMembers(false);
    }
  }, [
    exactCircleMatches,
    friendCircleQuery,
    isFriendDrawerOpen,
    normalizedCircleQuery,
    selectedFriendCircle,
  ]);

  useEffect(() => {
    if (!isFriendDrawerOpen || !selectedFriendCircle) {
      friendCircleMembersRequestRef.current += 1;
      setCircleMembers([]);
      setLoadingCircleMembers(false);
      return;
    }

    void loadMembersForCircle(selectedFriendCircle);
  }, [isFriendDrawerOpen, loadMembersForCircle, selectedFriendCircle]);

  useEffect(() => {
    if (!selectedFriendCircle) {
      setSelectedFriendTarget(null);
      return;
    }

    if (!normalizedTargetQuery) {
      setSelectedFriendTarget(null);
      return;
    }

    if (exactTargetMatches.length === 1) {
      const nextTarget = exactTargetMatches[0];
      if (selectedFriendTarget?.userId !== nextTarget.userId) {
        setSelectedFriendTarget(nextTarget);
      }
      if (friendTargetQuery !== (nextTarget.nickname || '')) {
        setFriendTargetQuery(nextTarget.nickname || '');
      }
      return;
    }

    if (
      selectedFriendTarget &&
      normalizeLookupText(selectedFriendTarget.nickname || '') !== normalizedTargetQuery
    ) {
      setSelectedFriendTarget(null);
    }
  }, [
    exactTargetMatches,
    friendTargetQuery,
    normalizedTargetQuery,
    selectedFriendCircle,
    selectedFriendTarget,
  ]);

  useEffect(() => {
    if (isContactsDrawerOpen) return;
    addressBookDetailRequestRef.current += 1;
    setSelectedAddressBookFriend(null);
    setAddressBookDetail(null);
    setAddressBookDetailError(null);
    setLoadingAddressBookDetail(false);
  }, [isContactsDrawerOpen]);

  useEffect(() => {
    if (isFriendDrawerOpen) return;
    friendCircleMembersRequestRef.current += 1;
    setFriendCircleQuery('');
    setSelectedFriendCircle(null);
    setJoinedCircles([]);
    setCircleMembers([]);
    setFriendTargetQuery('');
    setSelectedFriendTarget(null);
    setFriendMessage('');
    setLoadingJoinedCircles(false);
    setLoadingCircleMembers(false);
  }, [isFriendDrawerOpen]);

  const closeArchiveDrawer = useCallback(() => {
    setIsArchiveDrawerOpen(false);
    setSelectedHistory(null);
    setSelectedHistoryResult(null);
    setIsHistoryDetailLoading(false);
  }, []);

  const closeHistoryDetail = useCallback(() => {
    setSelectedHistory(null);
    setSelectedHistoryResult(null);
    setIsHistoryDetailLoading(false);
    setIsBlockedArchivePartner(false);
    setIsBlockingArchivePartner(false);
    setReportDialogOpen(false);
    setReportReasons([]);
    setReportDetail('');
    setIsSubmittingReport(false);
  }, []);

  const openHistoryDetail = useCallback(async (item: MatchHistoryItem) => {
    setSelectedHistory(item);
    setSelectedHistoryResult(null);

    if (item.status === 'NO_MATCH') {
      setIsHistoryDetailLoading(false);
      return;
    }

    setIsHistoryDetailLoading(true);
    try {
      const res = await getMatchResult(item.matchId);
      setSelectedHistoryResult(res);
    } catch {
      toastError('这页旧档案暂时无法展开');
    } finally {
      setIsHistoryDetailLoading(false);
    }
  }, [toastError]);

  const handleCopyHistoryContact = useCallback(async (value: string, platformLabel: string) => {
    const copied = await copyText(value);
    if (copied) {
      toastSuccess(`${platformLabel}已复制`);
      return;
    }

    toastError('复制失败，请手动选中复制');
  }, [toastError, toastSuccess]);

  // 检测问卷版本是否过期
  useEffect(() => {
    if (!user?.surveyComplete) return;
    (async () => {
      try {
        const [qRes, aRes] = await Promise.all([getQuestions(), getAnswers()]);
        if (aRes.version && qRes.version && aRes.version !== qRes.version) {
          setSurveyOutdated(true);
        }
      } catch { /* 未提交过问卷等情况静默忽略 */}
    })();
  }, [user?.surveyComplete]);

  // 倒计时 ticker
  useEffect(() => {
    let timeoutId: number | null = null;

    const scheduleNextTick = () => {
      const now = Date.now();
      const delay = Math.max(50, 1000 - (now % 1000));

      timeoutId = window.setTimeout(() => {
        syncCountdown();
        scheduleNextTick();
      }, delay);
    };

    syncCountdown();
    const handleFocus = () => syncCountdown();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncCountdown();
      }
    };

    scheduleNextTick();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncCountdown]);

  const visualState = useMemo(() => {
    if (!matchData) return 'LOADING';
    const now = new Date();
        // 转换为北京时间计算揭晓周期
    const bj = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 8 * 3600000);
    const day = bj.getDay();
    const hours = bj.getHours();

    // 匹配揭晓周期："黄金48小时"，从周三推算
    const isRevealPeriod = (day === 3 && hours >= 20) || (day === 4) || (day === 5 && hours < 20);

    // 只在揭晓窗口内保留锦书入口；窗口结束或显式 EXPIRED 都回到倒计时视图。
    if (matchData.status === 'REVEALED' && isRevealPeriod) return 'REVEALED';

    if (!isRevealPeriod || matchData.status === 'WAITING' || matchData.status === 'PENDING' || matchData.status === 'EXPIRED') {
      return history.length === 0 ? 'NEW_USER_WAITING' : 'PENDING';
    }
    if (matchData.status === 'NO_MATCH') return 'NO_MATCH';
    return 'LOADING';
  }, [matchData, history.length, countdown]);

  // 暂停/恢复本周（Dashboard 专用，下周自动恢复）
  const handleTogglePauseWeek = async () => {
    if (!user || isTogglingStatus) return;
    if ((user.creditScore ?? 100) <= 90) {
      toastWarning('当前信用分未达标（需高于 90 分），暂不可恢复匹配');
      return;
    }
    if (!user.surveyComplete || surveyOutdated) {
      toastWarning('请先前往完成/更新问卷');
      return;
    }
    if (getIsMatchingLocked()) {
      toastWarning('匹配计算中，参与状态暂被锁定 (18:00-20:00)');
      return;
    }
    setIsTogglingStatus(true);
    const isPaused = user.pauseUntilWeek === getUpcomingWeekOf();
    try {
      await pauseWeek(!isPaused);
      await refreshUser();
      toastSuccess(isPaused ? '已恢复本周参与' : '已暂停本周匹配，下周将自动恢复');
    } catch (err: any) {
      toastError(err.message || '操作失败，请稍后重试');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  // 发送好友申请
  const handleSendFriendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFriendCircle) {
      toastWarning('请先确认结缘圈子');
      return;
    }

    if (!selectedFriendTarget) {
      toastWarning('请先从候选中确认目标同窗');
      return;
    }

    if (selectedFriendTarget.userId === user?.id) {
      toastWarning('不能给自己投递交际申请');
      return;
    }

    setSendingFriend(true);
    try {
      await sendFriendRequest({
        targetUserId: selectedFriendTarget.userId,
        circleId: selectedFriendCircle.id,
        message: friendMessage.trim(),
      });
      toastSuccess('申请投递成功！');
      setFriendCircleQuery('');
      setSelectedFriendCircle(null);
      setCircleMembers([]);
      setFriendTargetQuery('');
      setSelectedFriendTarget(null);
      setFriendMessage('');
    } catch (err: any) {
      toastError(err.response?.data?.error || err.message || '发送失败');
    } finally {
      setSendingFriend(false);
    }
  };

  // 处理好友申请 (接受/拒绝)
  const handleFriendAction = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      if (action === 'accept') {
        await acceptFriendRequest(requestId);
        toastSuccess('已成功结缘！');
        if (isContactsDrawerOpen) {
          void loadAddressBook();
        }
      } else {
        await rejectFriendRequest(requestId);
        toastSuccess('已婉拒该申请。');
      }
      setFriendRequests((prev) => prev.filter((r) => r.request_id !== requestId));
    } catch (err: any) {
      toastError(`处理失败: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleContactUnlockAction = async (requestId: string, action: 'approve' | 'reject', contactIds?: string[]) => {
    try {
      if (action === 'approve') {
        await approveContactUnlockRequest(requestId, contactIds);
        toastSuccess('已同意交换联系方式');
        if (isContactsDrawerOpen) {
          void loadAddressBook();
        }
      } else {
        await rejectContactUnlockRequest(requestId);
        toastSuccess('已婉拒交换联系方式');
      }
      setContactUnlockRequests((prev) => prev.filter((request) => request.request_id !== requestId));
      return true;
    } catch (err: any) {
      toastError(`处理失败: ${err.response?.data?.error || err.message || '请稍后重试'}`);
      return false;
    }
  };

  const closeCircleContactApproval = () => {
    if (submittingCircleContactApproval) return;
    setApprovingContactRequest(null);
    setCircleContactOptions([]);
    setSelectedCircleContactIds([]);
    setLoadingCircleContactOptions(false);
  };

  const openCircleContactApproval = async (request: ContactUnlockInboxItem) => {
    if (request.source_type !== 'circle') {
      await handleContactUnlockAction(request.request_id, 'approve');
      return;
    }
    if (!request.circle_id) {
      toastError('该联系方式申请缺少圈子上下文，暂时无法同意');
      return;
    }

    setApprovingContactRequest(request);
    setCircleContactOptions([]);
    setSelectedCircleContactIds([]);
    setLoadingCircleContactOptions(true);
    try {
      const res = await getCircleContacts(request.circle_id);
      const enabledContacts = uniqueCircleContacts((res.contacts || []).filter((contact) => contact.isEnabled));
      setCircleContactOptions(enabledContacts);
    } catch (err: any) {
      toastError(err.message || '加载圈内联系方式失败');
      setApprovingContactRequest(null);
    } finally {
      setLoadingCircleContactOptions(false);
    }
  };

  const toggleSelectedCircleContact = (contactId: string) => {
    setSelectedCircleContactIds((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const confirmCircleContactApproval = async () => {
    if (!approvingContactRequest || submittingCircleContactApproval) return;
    if (selectedCircleContactIds.length === 0) {
      toastWarning('请先选择至少一种要开放的圈内联系方式');
      return;
    }

    setSubmittingCircleContactApproval(true);
    try {
      const handled = await handleContactUnlockAction(approvingContactRequest.request_id, 'approve', selectedCircleContactIds);
      if (handled) {
        setApprovingContactRequest(null);
        setCircleContactOptions([]);
        setSelectedCircleContactIds([]);
      }
    } finally {
      setSubmittingCircleContactApproval(false);
    }
  };

  const handleRequestMoreCircleContacts = async (reply: ContactUnlockReplyItem) => {
    if (reply.source_type !== 'circle' || !reply.circle_id || requestingMoreContactReplyId) {
      return;
    }

    setRequestingMoreContactReplyId(reply.request_id);
    try {
      await sendContactUnlockRequest({
        targetUserId: reply.user_id,
        circleId: reply.circle_id,
        sourceType: 'circle',
      });
      toastSuccess('其他联系方式申请已发送');
    } catch (err: any) {
      if (err.code === 'CONTACT_REQUEST_EXISTS') {
        toastWarning('你已发送过其他联系方式申请');
      } else if (err.code === 'CONTACT_ALREADY_UNLOCKED') {
        toastWarning(err.message || '对方当前可开放的联系方式均已解锁');
      } else {
        toastError(err.message || '发送其他联系方式申请失败');
      }
    } finally {
      setRequestingMoreContactReplyId(null);
    }
  };

  const handleTeamUpApplicationAction = async (request: TeamUpApplicationInboxItem, action: 'approve' | 'reject') => {
    const requestKey = `${request.circleId}:${request.teamupId}:${request.id}`;
    if (reviewingTeamUpApplicationId) return;
    const isWaitlistApplication = request.applicationType === 'waitlist';

    setReviewingTeamUpApplicationId(requestKey);
    try {
      const result: any = await reviewTeamUpApplication(request.circleId, request.teamupId, request.id, action);
      toastSuccess(result.message || (action === 'approve' ? (isWaitlistApplication ? '已通过候补' : '已准入同游') : '已婉拒拜帖'));
      setTeamUpApplicationRequests((prev) => prev.filter((item) => item.id !== request.id));
    } catch (err: any) {
      if (err.code === 'APPLICATION_NOT_PENDING' || err.code === 'APPLICATION_NOT_FOUND') {
        toastWarning('这份拜帖已在别处处理，列表已刷新');
        await loadTeamUpApplications();
        return;
      }
      toastError(`处理失败: ${err.response?.data?.error || err.message || '请稍后重试'}`);
      void loadTeamUpApplications();
    } finally {
      setReviewingTeamUpApplicationId(null);
    }
  };

  const handleRequestAddressBookContact = async () => {
    if (!selectedAddressBookFriend || requestingAddressBookContact) {
      return;
    }

    setRequestingAddressBookContact(true);
    try {
      await sendContactUnlockRequest({
        targetUserId: selectedAddressBookFriend.userId,
        sourceType: 'address_book',
      });
      toastSuccess('联系方式申请已从同窗名录送出');
      setSelectedAddressBookFriend((prev) => (prev ? { ...prev, contactStatus: 'sent' } : prev));
      await loadAddressBook();
    } catch (err: any) {
      const message = err.message || '发送联系方式申请失败';
      if (message.includes('已发送过')) {
        setSelectedAddressBookFriend((prev) => (prev ? { ...prev, contactStatus: 'sent' } : prev));
      }
      toastError(message);
    } finally {
      setRequestingAddressBookContact(false);
    }
  };

  const openSnapshotPreview = useCallback((snapshot: CardSnapshotPreview | undefined, title: string, subtitle?: string) => {
    if (!snapshot) {
      toastWarning('这条消息暂未附带可翻阅的名片快照');
      return;
    }

    setActiveSnapshot({
      title,
      subtitle,
      snapshot,
    });
  }, [toastWarning]);

  const closeAddressBookFriendDetail = useCallback(() => {
    addressBookDetailRequestRef.current += 1;
    setSelectedAddressBookFriend(null);
    setAddressBookDetail(null);
    setAddressBookDetailError(null);
    setLoadingAddressBookDetail(false);
    setRequestingAddressBookContact(false);
    setRemovingAddressBookFriend(false);
    setRevokingContactRequestId(null);
    setIsBlockedAddressBookFriend(false);
    setIsBlockingAddressBookFriend(false);
    setReportDialogOpen(false);
    setReportReasons([]);
    setReportDetail('');
    setIsSubmittingReport(false);
  }, []);

  const handleOpenAddressBookFriend = async (friend: AddressBookEntry) => {
    const requestId = addressBookDetailRequestRef.current + 1;
    addressBookDetailRequestRef.current = requestId;
    setSelectedAddressBookFriend(friend);
    setAddressBookDetail(null);
    setAddressBookDetailError(null);
    setLoadingAddressBookDetail(true);
    setRequestingAddressBookContact(false);

    try {
      const [baseCard, circleCardResults, contactsResult] = await Promise.all([
        getFriendCard(friend.userId),
        Promise.allSettled(
          friend.circles.map(async (circle) => ({
            circle,
            card: await getFriendCard(friend.userId, circle.circleId),
          })),
        ),
        friend.hasUnlockedContacts
          ? getUnlockedContacts(friend.userId)
          : Promise.resolve({ contacts: [] }),
      ]);

      if (addressBookDetailRequestRef.current !== requestId) {
        return;
      }

      const failedCircleCards = circleCardResults.filter((result) => result.status === 'rejected');
      if (failedCircleCards.length > 0) {
        console.error('部分圈子名片加载失败', failedCircleCards);
      }

      setAddressBookDetail({
        contacts: contactsResult.contacts || [],
        baseModules: (baseCard.modules || []).map((module) => ({
          moduleKey: module.moduleKey,
          label: module.label,
          value: String(module.value ?? ''),
        })),
        circleCards: circleCardResults.flatMap((result) => {
          if (result.status !== 'fulfilled') {
            return [];
          }

          return [{
            circleId: result.value.circle.circleId,
            circleName: result.value.circle.circleName,
            friendSince: result.value.circle.friendSince,
            modules: result.value.card.circleHighlights.map((item) => ({
              key: item.key,
              label: item.label,
              value: item.value,
            })),
          }];
        }),
      });
    } catch (err: any) {
      console.error('加载同窗详情失败', err);
      if (addressBookDetailRequestRef.current !== requestId) {
        return;
      }
      setAddressBookDetailError(err.message || '加载同窗详情失败，请稍后重试');
    } finally {
      if (addressBookDetailRequestRef.current === requestId) {
        setLoadingAddressBookDetail(false);
      }
    }
  };

  const handleRemoveAddressBookFriend = async () => {
    if (!selectedAddressBookFriend || removingAddressBookFriend) {
      return;
    }

    const confirmed = await confirm({
      title: '解除全部好友',
      message: `确认从同窗名录中解除「${selectedAddressBookFriend.nickname || '这位同窗'}」吗？这会一次性删除你们在全部圈子的好友关系；只有全部圈子的好友关系都解除后，联系方式才会自动消失。`,
      confirmText: '解除',
      tone: 'danger',
      icon: 'person_remove',
    });
    if (!confirmed) {
      return;
    }

    setRemovingAddressBookFriend(true);
    try {
      const result = await deleteFriendEverywhere(selectedAddressBookFriend.userId);
      const removedCircleCount = result.removedCircleCount ?? result.removedCircleIds?.length ?? 0;
      toastSuccess(`已解除全部 ${removedCircleCount} 个圈子的好友关系，联系方式将自动隐藏。`);
      closeAddressBookFriendDetail();
      await loadAddressBook();
    } catch (err: any) {
      toastError(err.message || '从同窗名录解除好友失败');
      setRemovingAddressBookFriend(false);
    }
  };

  const handleRevokeAddressBookContact = async () => {
    if (!selectedAddressBookFriend || !selectedRevocableContactRequestId || revokingContactRequestId) {
      return;
    }

    const confirmed = await confirm({
      title: '撤销联系方式授权',
      message: `确认撤销给「${selectedAddressBookFriend.nickname || '这位同窗'}」的联系方式授权吗？撤销后，对方将不能继续查看这份联络印记。`,
      confirmText: '撤销授权',
      cancelText: '再想想',
      tone: 'danger',
      icon: 'lock_reset',
    });
    if (!confirmed) return;

    setRevokingContactRequestId(selectedRevocableContactRequestId);
    try {
      const result = await revokeContactUnlockRequest(selectedRevocableContactRequestId);
      toastSuccess(result.message || '已撤销联系方式授权');
      setSelectedAddressBookFriend((prev) => (
        prev
          ? {
              ...prev,
              contactStatus: 'idle',
              hasUnlockedContacts: false,
              revocableContactRequestId: undefined,
            }
          : prev
      ));
      setAddressBookDetail((prev) => (prev ? { ...prev, contacts: [] } : prev));
      await Promise.all([
        loadAddressBook(),
        loadContactUnlockRequests(),
      ]);
    } catch (err: any) {
      toastError(err.message || '撤销联系方式授权失败');
    } finally {
      setRevokingContactRequestId(null);
    }
  };

  const canSafetyActOnAddressBookFriend = Boolean(
    selectedAddressBookFriend && selectedAddressBookFriend.userId !== user?.id,
  );
  const archivePartnerId = selectedHistory?.partner?.id || null;
  const canSafetyActOnArchivePartner = Boolean(
    selectedHistory?.partner && selectedHistory.status !== 'NO_MATCH' && archivePartnerId && archivePartnerId !== user?.id,
  );

  const handleToggleAddressBookBlock = useCallback(async () => {
    if (!selectedAddressBookFriend || !canSafetyActOnAddressBookFriend || isBlockingAddressBookFriend) {
      return;
    }
    const confirmed = await confirm({
      title: isBlockedAddressBookFriend ? '解除拉黑' : '拉黑同窗',
      message: isBlockedAddressBookFriend ? '确认解除拉黑这位同窗？' : '确认拉黑这位同窗？拉黑后将屏蔽与对方的后续互动。',
      confirmText: isBlockedAddressBookFriend ? '解除拉黑' : '拉黑',
      tone: isBlockedAddressBookFriend ? 'default' : 'danger',
      icon: isBlockedAddressBookFriend ? 'lock_open' : 'block',
    });
    if (!confirmed) return;
    setIsBlockingAddressBookFriend(true);
    try {
      if (isBlockedAddressBookFriend) {
        const res = await unblockUser(selectedAddressBookFriend.userId);
        toastSuccess(res.message || '已解除拉黑');
        setIsBlockedAddressBookFriend(false);
      } else {
        const res = await blockUser(selectedAddressBookFriend.userId);
        toastSuccess(res.message || '已拉黑该用户');
        setIsBlockedAddressBookFriend(true);
      }
    } catch (err: any) {
      toastError(err.message || '操作失败，请稍后重试');
    } finally {
      setIsBlockingAddressBookFriend(false);
    }
  }, [
    canSafetyActOnAddressBookFriend,
    confirm,
    isBlockedAddressBookFriend,
    isBlockingAddressBookFriend,
    selectedAddressBookFriend,
    toastError,
    toastSuccess,
  ]);

  const handleSubmitAddressBookReport = useCallback(async () => {
    if (!selectedAddressBookFriend || !canSafetyActOnAddressBookFriend || isSubmittingReport) {
      return;
    }
    setIsSubmittingReport(true);
    try {
      const res = await reportUser(selectedAddressBookFriend.userId, {
        reasons: reportReasons,
        detail: reportDetail.trim() || undefined,
      });
      toastSuccess(res.message || '举报已提交，我们将尽快处理');
      setReportDialogOpen(false);
      setReportReasons([]);
      setReportDetail('');
    } catch (err: any) {
      toastError(err.message || '举报失败，请稍后重试');
    } finally {
      setIsSubmittingReport(false);
    }
  }, [
    canSafetyActOnAddressBookFriend,
    isSubmittingReport,
    reportDetail,
    reportReasons,
    selectedAddressBookFriend,
    toastError,
    toastSuccess,
  ]);

  const handleToggleArchivePartnerBlock = useCallback(async () => {
    if (!archivePartnerId || !canSafetyActOnArchivePartner || isBlockingArchivePartner) {
      return;
    }
    const confirmed = await confirm({
      title: isBlockedArchivePartner ? '解除拉黑' : '拉黑同窗',
      message: isBlockedArchivePartner ? '确认解除拉黑这位同窗？' : '确认拉黑这位同窗？拉黑后将屏蔽与对方的后续互动。',
      confirmText: isBlockedArchivePartner ? '解除拉黑' : '拉黑',
      tone: isBlockedArchivePartner ? 'default' : 'danger',
      icon: isBlockedArchivePartner ? 'lock_open' : 'block',
    });
    if (!confirmed) return;
    setIsBlockingArchivePartner(true);
    try {
      if (isBlockedArchivePartner) {
        const res = await unblockUser(archivePartnerId);
        toastSuccess(res.message || '已解除拉黑');
        setIsBlockedArchivePartner(false);
      } else {
        const res = await blockUser(archivePartnerId);
        toastSuccess(res.message || '已拉黑该用户');
        setIsBlockedArchivePartner(true);
      }
    } catch (err: any) {
      toastError(err.message || '操作失败，请稍后重试');
    } finally {
      setIsBlockingArchivePartner(false);
    }
  }, [
    archivePartnerId,
    canSafetyActOnArchivePartner,
    confirm,
    isBlockedArchivePartner,
    isBlockingArchivePartner,
    toastError,
    toastSuccess,
  ]);

  const handleSubmitArchiveReport = useCallback(async () => {
    if (!archivePartnerId || !canSafetyActOnArchivePartner || isSubmittingReport) {
      return;
    }
    setIsSubmittingReport(true);
    try {
      const res = await reportUser(archivePartnerId, {
        reasons: reportReasons,
        detail: reportDetail.trim() || undefined,
      });
      toastSuccess(res.message || '举报已提交，我们将尽快处理');
      setReportDialogOpen(false);
      setReportReasons([]);
      setReportDetail('');
    } catch (err: any) {
      toastError(err.message || '举报失败，请稍后重试');
    } finally {
      setIsSubmittingReport(false);
    }
  }, [
    archivePartnerId,
    canSafetyActOnArchivePartner,
    isSubmittingReport,
    reportDetail,
    reportReasons,
    toastError,
    toastSuccess,
  ]);

  useEffect(() => {
    if (!selectedAddressBookFriend || !canSafetyActOnAddressBookFriend) {
      setIsBlockedAddressBookFriend(false);
      return;
    }
    let cancelled = false;
    getBlockStatus(selectedAddressBookFriend.userId)
      .then((res) => {
        if (!cancelled) {
          setIsBlockedAddressBookFriend(Boolean(res.blocked));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsBlockedAddressBookFriend(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canSafetyActOnAddressBookFriend, selectedAddressBookFriend]);

  useEffect(() => {
    if (!archivePartnerId || !canSafetyActOnArchivePartner) {
      setIsBlockedArchivePartner(false);
      return;
    }
    let cancelled = false;
    getBlockStatus(archivePartnerId)
      .then((res) => {
        if (!cancelled) {
          setIsBlockedArchivePartner(Boolean(res.blocked));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsBlockedArchivePartner(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [archivePartnerId, canSafetyActOnArchivePartner]);

  const filteredAddressBookEntries = useMemo(() => (
    contactsOnlyFilter
      ? addressBookEntries.filter((entry) => entry.hasUnlockedContacts)
      : addressBookEntries
  ), [addressBookEntries, contactsOnlyFilter]);

  const selectedRevocableContactRequestId = useMemo(() => (
    selectedAddressBookFriend?.revocableContactRequestId
    || addressBookDetail?.contacts.find((contact) => contact.requestId)?.requestId
    || null
  ), [addressBookDetail?.contacts, selectedAddressBookFriend?.revocableContactRequestId]);

  const friendReplyKey = useCallback((reply: AcceptedFriendRequest) => (
    `friend:${reply.request_id}:${reply.status}:${reply.responded_at}`
  ), []);
  const contactReplyKey = useCallback((reply: ContactUnlockReplyItem) => (
    `contact:${reply.request_id}:${reply.status}:${reply.responded_at}`
  ), []);
  const teamupReplyKey = useCallback((reply: TeamUpApplicationReply) => (
    `teamup:${reply.id}:${reply.status}:${reply.respondedAt}`
  ), []);

  const friendRepliesToShow = useMemo(() => (
    [...acceptedFriendRequests]
      .sort((a, b) => timeValue(b.responded_at) - timeValue(a.responded_at))
      .slice(0, 3)
  ), [acceptedFriendRequests]);
  const contactRepliesToShow = useMemo(() => (
    [...contactUnlockReplies]
      .sort((a, b) => timeValue(b.responded_at) - timeValue(a.responded_at))
      .slice(0, 3)
  ), [contactUnlockReplies]);
  const teamupRepliesToShow = useMemo(() => (
    [...teamUpApplicationReplies]
      .sort((a, b) => timeValue(b.respondedAt) - timeValue(a.respondedAt))
      .slice(0, 3)
  ), [teamUpApplicationReplies]);

  const visibleFriendReplies = expandedReplySections.friend ? friendRepliesToShow : friendRepliesToShow.slice(0, 1);
  const visibleContactReplies = expandedReplySections.contact ? contactRepliesToShow : contactRepliesToShow.slice(0, 1);
  const visibleTeamupReplies = expandedReplySections.teamup ? teamupRepliesToShow : teamupRepliesToShow.slice(0, 1);

  const trackedReplyIds = useMemo(() => [
    ...friendRepliesToShow.map(friendReplyKey),
    ...contactRepliesToShow.map(contactReplyKey),
    ...teamupRepliesToShow.map(teamupReplyKey),
  ], [
    friendRepliesToShow,
    contactRepliesToShow,
    teamupRepliesToShow,
    friendReplyKey,
    contactReplyKey,
    teamupReplyKey,
  ]);

  useEffect(() => {
    if (!isFriendDrawerOpen || trackedReplyIds.length === 0) return;

    setSeenReplyIds((prev) => {
      const next = new Set(prev);
      let changed = false;

      for (const replyId of trackedReplyIds) {
        if (!next.has(replyId)) {
          next.add(replyId);
          changed = true;
        }
      }

      if (!changed) return prev;
      localStorage.setItem(INBOX_REPLY_SEEN_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  }, [isFriendDrawerOpen, trackedReplyIds]);

  const unseenReplyCount = trackedReplyIds.filter((replyId) => !seenReplyIds.has(replyId)).length;

  const toggleReplySection = (section: ReplySectionKey) => {
    setExpandedReplySections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const timeLeft = secondsToDisplay(countdown);
  const avatarLetter = user?.nickname?.[0] || user?.email?.[0]?.toUpperCase() || '?';

  const normalizeTags = (value: string) =>
    value
      .split(/[，,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10);

  const inlineSaveProfile = async (newSignature: string, newTags: string[]) => {
    if (!user) return;
    const nextSignature = newSignature.trim();
    const nextTags = Array.from(new Set(newTags.map((item) => item.trim()).filter(Boolean))).slice(0, 10);

    setSavingProfileEnhancement(true);
    try {
      await updateSignature(nextSignature);
      await updateTags(nextTags);
      await refreshUser();
      setSignatureDraft(nextSignature);
      setTagDraft(nextTags);
      toastSuccess('个人档案已更新');
    } catch (err: any) {
      toastError(err?.message || '更新失败，请稍后重试');
    } finally {
      setSavingProfileEnhancement(false);
      setIsEditingSignature(false);
      setIsAddingTag(false);
      setNewTagInput('');
    }
  };

  const pendingInboxCount = friendRequests.length
    + contactUnlockRequests.length
    + teamUpApplicationRequests.length
    + unseenReplyCount;

  return (
    <div className="min-h-screen w-full font-sans text-[#2C2825] selection:bg-[#420047] selection:text-[#FCFBF8] bg-[#F5F3EF] flex overflow-x-hidden md:h-[100svh] md:overflow-hidden relative z-0">
      {/* 桌面全局柔光照明 */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_30%,#FFFFFF_0%,transparent_70%)] opacity-[0.85] pointer-events-none mix-blend-overlay"></div>

      <Announcement />
      <UpdateModal />

      {/* 桌面背景底盘 */}
      <div className="flex flex-col md:flex-row w-full min-h-screen md:h-[100svh] relative max-w-full overflow-hidden">

        {/* 左侧实体手账本 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full md:w-[420px] lg:w-[480px] xl:w-[520px] flex-shrink-0 relative z-20 md:h-full md:min-h-0 bg-[#FCFBF8] shadow-[2px_0_0_#F3F1ED,4px_0_0_#EAE7E1,25px_0_50px_rgba(139,115,85,0.15),inset_10px_0_20px_rgba(0,0,0,0.03)] border-r border-[#EAE7E1]/80 md:rounded-r-2xl"
        >
          {/* 右侧悬浮横向书签 / Post-it 标签 */}
          <div className="hidden md:flex absolute -right-[98px] top-28 flex-col gap-3 z-10 w-[98px]">
            <button
              onClick={() => setActiveTab('MATCH')}
              className={`relative flex items-center justify-center px-4 py-3 rounded-r-xl border border-l-0 transition-all duration-300 text-[13px] font-serif tracking-widest origin-left ${
                activeTab === 'MATCH'
                  ? 'bg-[#FCFBF8] border-[#EAE7E1] text-[#2C2825] font-medium z-20 shadow-[6px_4px_12px_rgba(139,115,85,0.08)] scale-x-105'
                  : 'bg-[#F3F1ED] border-[#EAE7E1] text-[#8B7355]/60 hover:text-[#8B7355] hover:bg-[#FCFBF8] z-0 scale-x-100 hover:scale-x-[1.03]'
              }`}
            >
              寻缘匹配
            </button>
            <button
              onClick={() => setActiveTab('CIRCLE')}
              className={`relative flex items-center justify-center px-4 py-3 rounded-r-xl border border-l-0 transition-all duration-300 text-[13px] font-serif tracking-widest origin-left ${
                activeTab === 'CIRCLE'
                  ? 'bg-[#FCFBF8] border-[#EAE7E1] text-[#2C2825] font-medium z-20 shadow-[6px_4px_12px_rgba(139,115,85,0.08)] scale-x-105'
                  : 'bg-[#F3F1ED] border-[#EAE7E1] text-[#8B7355]/60 hover:text-[#8B7355] hover:bg-[#FCFBF8] z-0 scale-x-100 hover:scale-x-[1.03]'
              }`}
            >
              校友圈子
              {pendingInboxCount > 0 && <span className="absolute top-2.5 right-2 w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
            </button>
            <button
              onClick={() => setActiveTab('PROFILE')}
              className={`relative flex items-center justify-center px-4 py-3 rounded-r-xl border border-l-0 transition-all duration-300 text-[13px] font-serif tracking-widest origin-left ${
                activeTab === 'PROFILE'
                  ? 'bg-[#FCFBF8] border-[#EAE7E1] text-[#2C2825] font-medium z-20 shadow-[6px_4px_12px_rgba(139,115,85,0.08)] scale-x-105'
                  : 'bg-[#F3F1ED] border-[#EAE7E1] text-[#8B7355]/60 hover:text-[#8B7355] hover:bg-[#FCFBF8] z-0 scale-x-100 hover:scale-x-[1.03]'
              }`}
            >
              论坛
            </button>
          </div>

          {/* 回归自然的内页装订弧度与阴影 */}
          <div className="absolute top-0 bottom-0 left-0 w-10 bg-gradient-to-r from-black/[0.05] via-black/[0.01] to-transparent pointer-events-none z-30" />
          <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-black/5 pointer-events-none z-30" />

          {/* 手账本左侧复古双线圈装订效果 */}
          <div className="hidden md:flex absolute top-0 bottom-0 -left-[6px] w-8 z-40 flex-col justify-evenly py-10 pointer-events-none">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="relative flex items-center h-5 w-full">
                {/* 纸张孔洞 */}
                <div className="absolute left-[14px] w-2.5 h-2.5 rounded-full bg-[#F5F3EF] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2),inset_-1px_-1px_2px_rgba(255,255,255,0.5)]" />
                {/* 顶部金属线圈 */}
                <div className="absolute left-0 w-[22px] h-[2.5px] bg-gradient-to-b from-[#A68F74] via-[#755D42] to-[#5C4831] rounded-full shadow-[1px_2px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.3)] rotate-[-6deg] -translate-y-[2px]" />
                {/* 底部金属线圈 */}
                <div className="absolute left-0 w-[22px] h-[2.5px] bg-gradient-to-b from-[#A68F74] via-[#755D42] to-[#5C4831] rounded-full shadow-[1px_2px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.3)] rotate-[-6deg] translate-y-[3px]" />
              </div>
            ))}
          </div>

          {/* 手账本内页可视容器与滚动区 */}
          <div className="flex flex-col gap-6 p-6 md:p-8 md:pl-14 lg:p-8 lg:pl-16 pb-4 lg:pb-6 h-full overflow-y-auto scrollbar-hide w-full">
            <header className="flex justify-between items-center mb-4 relative z-10">
            <Link to="/" className="flex items-center gap-2.5 font-serif tracking-widest text-lg text-[#2C2825] hover:text-[#8B7355] transition-colors group">
              <img src="/icon.svg" alt="Logo" className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" />
              <span>NJU Match</span>
            </Link>
            <div className="flex items-center gap-6">
              {/* 更新日志入口 + 新版提示 */}
              <div className="relative flex flex-col items-center">
                <Link
                  to="/changelog"
                  state={{ fromDashboard: true }}
                  className="text-sm tracking-wide font-medium text-[#8B7355] hover:text-[#2C2825] transition-colors relative"
                  onClick={() => {
                    localStorage.setItem(CHANGELOG_SEEN_KEY, CHANGELOG_NOTICE.version);
                    setShowChangelogBadge(false);
                  }}
                >
                  更新日志
                                    {/* 红点 */}
                  <AnimatePresence>
                    {showChangelogBadge && (
                      <motion.span
                        key="changelog-dot"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="absolute -top-1 -right-2 w-[6px] h-[6px] rounded-full bg-[#420047] animate-pulse"
                      />
                    )}
                  </AnimatePresence>
                </Link>
                {/* Tooltip */}
                <AnimatePresence>
                  {showChangelogBadge && (
                    <motion.span
                      key="changelog-tooltip"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                      className="absolute top-full mt-1.5 whitespace-nowrap text-[10px] tracking-widest text-[#420047] font-serif pointer-events-none"
                    >
                      {CHANGELOG_NOTICE.summary}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {/* 消息中心入口 */}
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                className="relative text-sm tracking-wide font-medium text-[#8B7355] hover:text-[#2C2825] transition-colors"
              >
                消息
                {notifUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-3 min-w-[16px] h-[16px] rounded-full bg-[#420047] text-[#FCFBF8] text-[9px] font-semibold flex items-center justify-center px-[3px]">
                    {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                  </span>
                )}
              </button>
              <Link to="/account" className="text-sm tracking-wide uppercase font-medium text-[#8B7355] hover:text-[#2C2825] transition-colors">
                设置
              </Link>
            </div>
          </header>
    
          {/* 迎宾印记 */}
          <div className="flex flex-col gap-5">
            <div className="w-20 h-20 shrink-0 rounded-full border border-[#8B7355] text-[#8B7355] flex items-center justify-center font-serif text-2xl md:text-3xl rotate-[-2deg] relative shadow-sm bg-[#FCFBF8]">
              <div className="absolute inset-1 rounded-full border border-dashed border-[#8B7355]/40 animate-[spin_60s_linear_infinite]" />
              {avatarLetter}
            </div>
            <div className="mt-2">
              <h3 className="font-serif text-2xl md:text-3xl text-[#2C2825] mb-3 font-medium tracking-wide">
                {user?.nickname || '同学'}，你好
              </h3>
              {activeTab === 'PROFILE' && (
		              <div className="mb-3 mt-4 flex items-center gap-5 md:gap-6">
                <button
                  type="button"
                  onClick={() => navigate('/follows?tab=following')}
	                  className="flex items-baseline gap-2 cursor-pointer text-base text-[#8B7355]/80 transition-colors hover:text-[#420047]"
                >
	                  <span className="font-serif text-lg leading-none">{followSummary.followingCount}</span>
                  <span>关注</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/follows?tab=followers')}
	                  className="flex items-baseline gap-2 cursor-pointer text-base text-[#8B7355]/80 transition-colors hover:text-[#420047]"
                >
	                  <span className="font-serif text-lg leading-none">{followSummary.followerCount}</span>
                  <span>粉丝</span>
                </button>
	              </div>
              )}
              <p className="text-sm text-[#8B7355] leading-relaxed w-5/6 italic font-serif opacity-80">
                档案册的新篇章。<br/>笔迹未干，故事待续。
              </p>
            </div>
          </div>
    
          <div className="w-16 h-[1px] bg-[#8B7355]/30 my-2 relative z-10" />

          {/* Project B 新增模块：与原有匹配/圈子/论坛明确分栏。 */}
          <div className="grid grid-cols-2 gap-2" aria-label="本阶段新增功能">
            <button type="button" onClick={() => navigate('/resonance')} className="rounded-2xl bg-[#EEE6ED]/65 px-3 py-3 text-left transition-colors hover:bg-[#E5D8E4]">
              <span className="block text-[9px] tracking-[0.18em] text-[#611066]">NEW MODULE</span>
              <strong className="mt-1 block font-serif text-sm font-normal text-[#2C2825]">共鸣胶囊</strong>
            </button>
            <button type="button" onClick={() => navigate('/meetup-safety')} className="rounded-2xl bg-[#EFEAE2]/75 px-3 py-3 text-left transition-colors hover:bg-[#E8E0D5]">
              <span className="block text-[9px] tracking-[0.18em] text-[#8B7355]">NEW MODULE</span>
              <strong className="mt-1 block font-serif text-sm font-normal text-[#2C2825]">安心赴约</strong>
            </button>
          </div>

          {/* 移动端专属：传统的顶部切换Tab */}
          <div className="relative mt-2 mb-1 flex items-end md:hidden">
            <div className="relative z-10 flex w-full gap-1.5">
              <button
                onClick={() => setActiveTab('MATCH')}
                className={`relative px-4 py-[6px] rounded-t-md font-serif tracking-widest text-[12px] border transition-all ${
                  activeTab === 'MATCH' 
                    ? 'bg-[#F3F1ED] border-[#EAE7E1] border-b-transparent text-[#2C2825] font-medium z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] translate-y-[1px]'
                    : 'bg-[#FCFBF8] border-[#EAE7E1] text-[#8B7355]/60 hover:text-[#8B7355] hover:bg-[#F3F1ED] z-0'
                }`}
              >
                寻缘匹配
                {activeTab === 'MATCH' && <div className="absolute -bottom-[2px] left-0 w-full h-[3px] bg-[#F3F1ED]" />}
              </button>
              <button
                onClick={() => setActiveTab('CIRCLE')}
                className={`relative px-4 py-[6px] rounded-t-md font-serif tracking-widest text-[12px] border transition-all ${
                  activeTab === 'CIRCLE' 
                    ? 'bg-[#F3F1ED] border-[#EAE7E1] border-b-transparent text-[#2C2825] font-medium z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] translate-y-[1px]'
                    : 'bg-[#FCFBF8] border-[#EAE7E1] text-[#8B7355]/60 hover:text-[#8B7355] hover:bg-[#F3F1ED] z-0'
                }`}
              >
                校友圈子
                {pendingInboxCount > 0 && <span className="absolute top-[8px] right-[10px] w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                {activeTab === 'CIRCLE' && <div className="absolute -bottom-[2px] left-0 w-full h-[3px] bg-[#F3F1ED]" />}
              </button>
              <button
                onClick={() => setActiveTab('PROFILE')}
                className={`relative px-4 py-[6px] rounded-t-md font-serif tracking-widest text-[12px] border transition-all ${
                  activeTab === 'PROFILE'
                    ? 'bg-[#F3F1ED] border-[#EAE7E1] border-b-transparent text-[#2C2825] font-medium z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] translate-y-[1px]'
                    : 'bg-[#FCFBF8] border-[#EAE7E1] text-[#8B7355]/60 hover:text-[#8B7355] hover:bg-[#F3F1ED] z-0'
                }`}
              >
                个人主页
                {activeTab === 'PROFILE' && <div className="absolute -bottom-[2px] left-0 w-full h-[3px] bg-[#F3F1ED]" />}
              </button>
            </div>
            {/* 标签下方衬垫，制造层叠感 */}
            <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#EAE7E1] z-10" />
          </div>
    
          {/* 状态便条区 */}
          <div className="flex-1 flex flex-col w-full mt-2 pr-1 pb-4 relative z-10">
            
            <AnimatePresence mode="wait">
              {activeTab === 'MATCH' && (
                <motion.div
                  key="MATCH"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-5"
                >
                  {/* 寻缘问卷 */}
                  <button
                    onClick={() => navigate('/survey')}
                    className="cursor-pointer bg-[#F3F1ED]/80 p-5 relative shadow-sm rotate-[0.5deg] hover:rotate-0 hover:bg-[#EAE7E1]/60 active:scale-[0.98] transition-all duration-300 rounded-sm text-left w-full group"
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-6 bg-[#EAE7E1] backdrop-blur-sm rotate-[-1deg] shadow-sm flex items-center justify-center pointer-events-none">
                      <div className="w-full h-full bg-white/30 skew-x-12" />
                    </div>
                    {surveyOutdated && <span className="absolute top-2 right-3 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />}
                    <div className="flex items-center gap-3 mb-5 mt-2">
                      <MaterialIcon name="history_edu" className="text-[20px] text-[#8B7355]" />
                      <span className="text-[13px] uppercase tracking-widest text-[#8B7355] font-medium">寻缘问卷</span>
                    </div>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="font-serif text-2xl text-[#2C2825] group-hover:text-[#420047] transition-colors">{surveyOutdated ? '有更新' : user?.surveyComplete ? '已落笔' : '未完成'}</span>
                      <div className="flex items-center gap-1 text-sm font-medium text-[#420047] opacity-80 group-hover:opacity-100 transition-opacity">
                        <span>{surveyOutdated ? '去更新' : user?.surveyComplete ? '翻阅修润' : '执笔填写'}</span>
                        <MaterialIcon name="arrow_forward" className="text-[16px]" />
                      </div>
                    </div>
                    {getIsMatchingLocked() && (
                      <p className="text-xs text-red-500 font-serif mt-2 mb-1 opacity-80 leading-snug">
                        当前为匹配计算期，问卷系统暂停提交至周三 20:00
                      </p>
                    )}
                    <svg width="80" height="8" viewBox="0 0 80 8" fill="none" className="opacity-30 mt-2">
                      <path d="M2 5.5C18.5 2.5 54 -1.5 78 6" stroke="#8B7355" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>

                  <div className="flex gap-4">
                    {/* 心动信笺 */}
                    <button
                      onClick={() => navigate(heartboxData?.latestHeartboxMatch?.status === 'active' ? '/heartbox/reveal' : '/heartbox')}
                      className="flex-1 cursor-pointer bg-[#F3F1ED]/80 px-4 py-4 relative shadow-sm rotate-[-1deg] hover:rotate-0 hover:bg-[#EAE7E1]/60 active:scale-[0.98] transition-transform duration-300 rounded-sm text-left group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MaterialIcon name="redeem" className="text-[18px] text-[#8B7355]" />
                          <span className="text-[12px] uppercase tracking-widest text-[#8B7355] font-medium">心动信笺</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs font-medium text-[#420047] opacity-80 group-hover:opacity-100 transition-opacity">
                          <span>{heartboxData?.latestHeartboxMatch?.status === 'active' ? '去启封' : '去投递'}</span>
                          <MaterialIcon name="arrow_forward" className="text-[14px]" />
                        </div>
                      </div>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="font-serif text-lg text-[#2C2825] group-hover:text-[#420047] transition-colors">悄悄投递</span>
                        {heartboxData?.latestHeartboxMatch?.status === 'active' ? (
                          <span className="inline-flex relative -top-0.5 items-center px-1.5 py-0.5 rounded text-[9px] tracking-widest font-medium bg-[#420047] text-[#FCFBF8]">
                            双向已成
                          </span>
                        ) : heartboxData?.incomingHint?.hasIncoming ? (
                          <span className="inline-flex relative -top-0.5 items-center px-1.5 py-0.5 rounded text-[9px] tracking-widest font-medium bg-[#5C0064] text-[#FCFBF8]">
                            有人心动你
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-[#8B7355] font-serif italic mt-0.5 opacity-80 line-clamp-1 leading-snug">
                        独立启封，双向后暂停主线
                      </p>
                    </button>

                    {/* 人格类型便条 */}
                    {(() => {
                      const pInfo = savedPersonality ? TYPE_INFO[savedPersonality.finalType] : null;
                      return (
                        <button
                          onClick={() => navigate(savedPersonality ? (surveyOutdated ? '/personality-test' : '/personality-result') : '/personality-test')}
                          className="flex-1 cursor-pointer bg-[#F3F1ED]/80 px-4 py-4 relative shadow-sm rotate-[0.5deg] hover:rotate-0 hover:bg-[#EAE7E1]/60 active:scale-[0.98] transition-all duration-300 rounded-sm text-left group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <MaterialIcon name="psychology" className="text-[18px] text-[#8B7355]" />
                              <span className="text-[12px] uppercase tracking-widest text-[#8B7355] font-medium">人格类型</span>
                            </div>
                            <div className="flex items-center gap-1 text-xs font-medium text-[#420047] opacity-80 group-hover:opacity-100 transition-opacity">
                              <span>{savedPersonality ? (surveyOutdated ? '去测试' : '查看详情') : '去测试'}</span>
                              <MaterialIcon name="arrow_forward" className="text-[14px]" />
                            </div>
                          </div>
                          <div className="mt-2 flex items-baseline gap-2">
                            <span className="font-serif text-lg text-[#2C2825] group-hover:text-[#420047] transition-colors line-clamp-1">
                              {pInfo ? `${pInfo.emoji} ${pInfo.nameCn}` : '未测试'}
                            </span>
                          </div>
                          <p className="text-[11px] font-serif italic text-[#8B7355] mt-0.5 leading-snug line-clamp-1">
                            {pInfo ? pInfo.tagline : '12种南大专属人格'}
                          </p>
                        </button>
                      );
                    })()}
                  </div>

            {/* 参与开关便条 */}
            {(() => {
              const isSurveyReady = user?.surveyComplete && !surveyOutdated;
              const isPausedThisWeek = user?.isParticipating && user?.pauseUntilWeek === getUpcomingWeekOf();
              const isPermOff = !user?.isParticipating;
              const isCreditLocked = (user?.creditScore ?? 100) <= 90;
                            
              // 问卷没完成时强制显示为关闭并不可交互
              const isActive = isSurveyReady && user?.isParticipating && !isPausedThisWeek;
              const isTimeLocked = getIsMatchingLocked();
              const isLocked = isTimeLocked || !isSurveyReady || isCreditLocked;
    
              const participationLabel = !isSurveyReady
                ? (surveyOutdated ? '问卷待更新' : '问卷待完成')
                : isCreditLocked
                  ? '信用分未达标'
                  : isPausedThisWeek
                    ? '本周已暂停'
                    : isPermOff
                      ? '长期已停止'
                      : '入局中';

              return (
                <div className={`p-5 relative border-l-[3px] border-dashed transition-all duration-500 hover:shadow-md ${isActive ? 'bg-[#FCFBF8] border-[#8B7355]' : 'bg-[#F3F1ED]/40 border-[#EAE7E1]'}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <MaterialIcon name={isActive ? 'favorite' : 'texture'} className="text-[20px] text-[#8B7355]" />
                    <span className="text-[13px] uppercase tracking-widest text-[#8B7355] font-medium">本周配对</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="font-serif text-xl tracking-wide text-[#2C2825]">
                      {participationLabel}
                    </span>
                    {isPermOff && isSurveyReady ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (isLocked) {
                            toastWarning('匹配计算中，不可跳转设置');
                            return;
                          }
                          navigate('/settings');
                        }}
                        className={`text-xs font-serif tracking-wide transition-colors ${isLocked ? 'text-[#8B7355]/50 cursor-not-allowed' : 'text-[#8B7355] hover:text-[#2C2825]'}`}
                      >
                        去设置开启
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleTogglePauseWeek}
                        disabled={isTogglingStatus}
                        className={`w-14 h-7 rounded-full relative transition-colors duration-300 flex-shrink-0 shadow-inner ${isTogglingStatus || isLocked ? 'opacity-60 cursor-not-allowed' : ''} ${isActive ? 'bg-[#8B7355]/20' : 'bg-[#EAE7E1]'}`}
                      >
                        <motion.div
                          className={`w-5 h-5 rounded-full absolute top-[4px] shadow-sm flex items-center justify-center ${isActive ? 'bg-[#8B7355]' : 'bg-white'}`}
                          animate={{ left: isActive ? '32px' : '4px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        >
                          {!isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#EAE7E1]" />}
                        </motion.div>
                      </button>
                    )}
                  </div>
                  {!isSurveyReady && (
                    <p className="text-[10px] text-[#8B7355]/80 mt-2 font-serif tracking-wide">请先完成问卷以解锁配对</p>
                  )}
                  {isSurveyReady && isPausedThisWeek && !isTimeLocked && !isCreditLocked && (
                    <p className="text-[10px] text-[#8B7355]/60 mt-2 font-serif tracking-wide">下周将自动恢复参与</p>
                  )}
                  {isSurveyReady && isTimeLocked && (
                    <p className="text-[10px] text-red-500/80 mt-2 font-serif tracking-wide">匹配计算中，状态暂时锁定</p>
                  )}
                  {isSurveyReady && isCreditLocked && (
                    <p className="text-[10px] text-red-500/80 mt-2 font-serif tracking-wide">信用分未达标（需高于 90 分），暂不可恢复匹配</p>
                  )}
                </div>
              );
            })()}
                </motion.div>
              )}

              {activeTab === 'CIRCLE' && (
                <motion.div
                  key="CIRCLE"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col gap-3"
                >

            <button
              onClick={() => navigate('/settings/card', { state: { backTo: '/dashboard' } })}
              className="cursor-pointer p-5 relative border border-[#EAE7E1] bg-[#F9F8F6] shadow-sm rounded-sm hover:bg-[#EAE7E1]/40 active:scale-[0.98] hover:border-[#8B7355]/40 transition-all duration-300 group text-left w-full"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-[#8B7355]/20 group-hover:bg-[#8B7355] transition-colors" />
              <div className="flex items-center gap-3 mb-4">
                <MaterialIcon name="badge" className="text-[20px] text-[#8B7355]" />
                <span className="text-[13px] uppercase tracking-widest text-[#8B7355] font-medium">圈子名片</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 font-serif text-xl tracking-wide text-[#2C2825] group-hover:text-[#420047] transition-colors">
                  在圈子里展示不同的你
                </span>
                <div className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-[#420047] opacity-80 group-hover:opacity-100 transition-opacity">
                  <MaterialIcon name="edit_document" className="text-[16px]" />
                  <span>排版修润</span>
                  <MaterialIcon name="arrow_forward" className="text-[16px]" />
                </div>
              </div>
              <p className="text-[10px] text-[#8B7355]/70 mt-3 font-serif tracking-wide leading-snug">
                进入不同圈子后，你展示给同好的名片内容也可以分别整理。
              </p>
            </button>
    
          {/* 圈子专属入口 */}
          <div className="pt-1 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => navigate('/circles')}
              className="group relative w-full overflow-hidden rounded-sm border border-[#EAE7E1] bg-[#F9F8F6] p-5 text-left shadow-sm transition-all duration-300 hover:border-[#8B7355]/40 hover:bg-[#EAE7E1]/40 active:scale-[0.98]"
            >
              <div className="absolute left-0 top-0 h-full w-1 bg-[#420047]/15 transition-colors group-hover:bg-[#420047]" />
              <div className="flex items-center gap-3 mb-4">
                <MaterialIcon name="public" className="text-[21px] text-[#8B7355]" />
                <span className="text-[13px] uppercase tracking-widest text-[#8B7355] font-medium">圈子大厅</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 font-serif text-xl tracking-wide text-[#2C2825] transition-colors group-hover:text-[#420047]">
                  去发现同频的小圈子
                </span>
                <div className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-[#420047] opacity-80 transition-opacity group-hover:opacity-100">
                  <span>进入大厅</span>
                  <MaterialIcon name="arrow_forward" className="text-[17px]" />
                </div>
              </div>
              <p className="mt-3 text-[10px] font-serif leading-snug tracking-wide text-[#8B7355]/70">
                浏览已加入和可加入的圈子，继续完善圈内名片、话题与组队频道。
              </p>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsContactsDrawerOpen(true)}
                className="text-[11px] text-[#8B7355] hover:text-[#2C2825] transition-colors flex items-center justify-center gap-1.5 group w-full py-2.5 border border-dashed border-transparent hover:bg-[#F3F1ED] border-[#EAE7E1] rounded-lg"
              >
                <MaterialIcon name="contacts" className="text-[14px]" />
                <span className="font-serif tracking-widest">同窗名录</span>
              </button>
    
              <button
                type="button"
                onClick={() => setIsFriendDrawerOpen(true)}
                className="text-[11px] relative text-[#8B7355] hover:text-[#2C2825] transition-colors flex items-center justify-center gap-1.5 group w-full py-2.5 border border-dashed border-transparent hover:bg-[#F3F1ED] border-[#EAE7E1] rounded-lg"
              >
                <MaterialIcon name="mark_email_unread" className="text-[14px]" />
                <span className="font-serif tracking-widest">交际信笺</span>
                {pendingInboxCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            </div>
          </div>
                </motion.div>
              )}

              {activeTab === 'PROFILE' && (
                <motion.div
                  key="PROFILE"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col h-full gap-6"
                >
                  <button
                    type="button"
                    onClick={() => navigate('/forum')}
                    className="-mt-8 mb-2 text-sm font-medium text-[#420047] hover:text-[#2C2825] transition-colors flex items-center justify-center gap-2 group w-full p-3 bg-[#420047]/5 hover:bg-[#420047]/10 rounded-lg border border-[#420047]/20">
                      <MaterialIcon name="forum" className="text-[18px]" />
                        <span className="font-serif tracking-widest">进入论坛主会场</span>
                  </button>
                  
                  {/* 信用分/获赞/获藏 顶栏数据 */}
                  <div className="flex items-center justify-center gap-16 mt-2 mb-2">
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-serif text-2xl text-[#420047]">{userStats.creditScore}</span>
                      <span className="flex items-center justify-center gap-[3px] text-[14px] font-serif tracking-[0.14em] text-[#8B7355]/60">
                        <span
                          className="material-symbols-outlined inline-flex h-[10px] w-[10px] items-center justify-center overflow-hidden text-[18px] leading-none text-[#8B7355]/45"
                          style={statLabelIconStyle}
                        >
                          verified_user
                        </span>
                        <span>信用分</span>
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <span className="font-serif text-2xl text-[#420047]">{userStats.receivedLikes}</span>
                      <span className="flex items-center justify-center gap-[3px] text-[14px] font-serif tracking-[0.14em] text-[#8B7355]/60">
                        <MaterialIcon
                          name="favorite"
                          className="inline-flex h-[10px] w-[10px] items-center justify-center overflow-hidden text-[8px] leading-none text-[#8B7355]/45"
                          style={statLabelIconStyle}
                        />
                        <span>获赞</span>
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-1">
                      <span className="font-serif text-2xl text-[#420047]">{userStats.receivedFavorites}</span>
                      <span className="flex items-center justify-center gap-[3px] text-[14px] font-serif tracking-[0.14em] text-[#8B7355]/60">
                        <MaterialIcon
                          name="star"
                          className="inline-flex h-[10px] w-[10px] items-center justify-center overflow-hidden text-[8px] leading-none text-[#8B7355]/45"
                          style={statLabelIconStyle}
                        />
                        <span>获藏</span>
                      </span>
                    </div>
                  </div>

                    <div className="text-center">
                      {isEditingSignature ? (
                        <textarea
                          value={signatureDraft}
                          onChange={(e) => setSignatureDraft(e.target.value)}
                          maxLength={200}
                          rows={3}
                          autoFocus
                          onBlur={async () => {
                            await inlineSaveProfile(signatureDraft, tagDraft);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void inlineSaveProfile(signatureDraft, tagDraft);
                            }
                          }}
                          className="w-full text-center font-serif text-xl text-[#8B7355] leading-relaxed outline-none resize-none bg-[#f3f2f0]/80 rounded-2xl border border-[#f3f2f0] p-4 shadow-[0_2px_10px_rgba(139,115,85,0.03)] focus:border-[#f3f2f0]/40 transition-all placeholder:text-[#8B7355]/50"
                          placeholder="写一句属于你的签名"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSignatureDraft(user?.signature ?? '');
                            setIsEditingSignature(true);
                          }}
                          className="w-full text-center font-serif text-xl text-[#8B7355]/80 leading-relaxed hover:text-[#420047] transition-colors"
                        >
                          {user?.signature?.trim() ? (
                            <>「{user.signature}」</>
                          ) : (
                            '暂无落笔，点击添加签名...'
                          )}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-center gap-2">
                      {(tagDraft.length > 0 ? tagDraft : []).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={async () => {
                            const nextTags = tagDraft.filter((item) => item !== tag);
                            await inlineSaveProfile(signatureDraft, nextTags);
                          }}
                          className="rounded-full border border-[#EAE7E1] bg-[#F9F8F6] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#420047] shadow-sm transition hover:line-through hover:opacity-70"
                        >
                          # {tag}
                        </button>
                      ))}
                      {tagDraft.length === 0 && !isAddingTag ? (
                        <span className="rounded-full border border-dashed border-[#EAE7E1] bg-[#F9F8F6] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8B7355]">暂无标签，点击 + 添置</span>
                      ) : null}
                      {isAddingTag ? (
                        <input
                          autoFocus
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          onBlur={async () => {
                            const nextValue = normalizeTags(newTagInput);
                            if (nextValue.length > 0) {
                              const nextTags = Array.from(new Set([...tagDraft, ...nextValue])).slice(0, 10);
                              await inlineSaveProfile(signatureDraft, nextTags);
                            } else {
                              setIsAddingTag(false);
                              setNewTagInput('');
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const nextValue = normalizeTags(newTagInput);
                              if (nextValue.length > 0) {
                                const nextTags = Array.from(new Set([...tagDraft, ...nextValue])).slice(0, 10);
                                void inlineSaveProfile(signatureDraft, nextTags);
                              }
                            }
                          }}
                          placeholder="输入标签"
                          className="min-w-[96px] rounded-full border border-[#EAE7E1] bg-transparent px-3 py-1 text-sm text-[#2C2825] outline-none ring-0 placeholder:text-[#8B7355]/60"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddingTag(true)}
                          className="rounded-full border border-dashed border-[#EAE7E1] bg-[#F9F8F6] px-3 py-1 text-sm text-[#420047] shadow-sm hover:bg-[#420047]/5"
                        >
                          +
                        </button>
                      )}
                    </div>

                  {/* 标题栏 */}

                  {/* 论坛聚合标签页 */}
                 <section className="mb-2">
                    {/* 1. 减小了移动端的左右内边距 (改为 px-3 py-5)，让内部空间更宽舒展 */}
                    <div className="rounded-2xl border border-[#EAE7E1] bg-white px-3 py-5 sm:p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
                      
                      {/* 2. 标签导航：均分展示个人论坛入口 */}
                      <div className="mb-4 grid grid-cols-5 border-b border-[#EAE7E1]">
                        {(['mine', 'liked', 'favorites', 'notifications', 'directMessages'] as ProfileSubTab[]).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setProfileSubTab(tab)}
                            // 3. 加入 whitespace-nowrap 强制不换行，并动态适配字体大小
                            className={`pb-2 text-center font-serif text-xs sm:text-sm whitespace-nowrap transition-all ${
                              profileSubTab === tab
                                ? 'text-[#420047] border-b-2 border-[#420047]'
                                : 'text-[#8B7355]/70 hover:text-[#8B7355]'
                            }`}
                          >
                            {tab === 'mine' && `我的 (${forumSummary.mine})`}
                            {tab === 'liked' && `赞过 (${forumSummary.liked})`}
                            {tab === 'favorites' && `收藏 (${forumSummary.favorites})`}
                            {tab === 'notifications' && `通知 (${unreadForumMessageCount})`}
                            {tab === 'directMessages' && `私信 (${unreadDirectMessageCount})`}
                          </button>
                        ))}
                      </div>

                      {/* 活动列表内容 (这里及下方的代码保持你原来的不变即可) */}
                      <div className="space-y-2 max-h-[216px] overflow-y-auto scrollbar-hide">
                        {profileSubTab === 'mine' && (
                          <>
                            {myPostsList.length > 0 ? (
                              <div className="space-y-2 max-h-[216px] overflow-y-auto scrollbar-hide">
                                {myPostsList.map((post) => (
                                  <div
                                    key={post.postId}
                                    onClick={() => handleOpenDashboardForumPost(post.postId)}
                                    className="flex items-center gap-3 rounded-lg bg-[#F9F8F6] p-3 transition-colors hover:bg-[#F3F1ED] cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[#420047] text-xl">article</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-serif text-sm text-[#2C2825]">{post.title}</p>
                                      <p className="mt-1 text-xs text-[#8B7355]/60">
                                        {new Date(post.createdAt).toLocaleDateString('zh-CN')} · {post.commentCount} 回响
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center text-sm text-[#8B7355]/60 py-4">暂无我的帖子</div>
                            )}
                          </>
                        )}
                        {profileSubTab === 'liked' && (
                          <>
                            {likedPostsList.length > 0 ? (
                              <div className="space-y-2 max-h-[216px] overflow-y-auto scrollbar-hide">
                                {likedPostsList.map((post) => (
                                  <div
                                    key={post.postId}
                                    onClick={() => handleOpenDashboardForumPost(post.postId)}
                                    className="flex items-center gap-3 rounded-lg bg-[#F9F8F6] p-3 transition-colors hover:bg-[#F3F1ED] cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[#420047] text-xl">favorite</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-serif text-sm text-[#2C2825]">{post.title}</p>
                                      <p className="mt-1 text-xs text-[#8B7355]/60">
                                        {new Date(post.createdAt).toLocaleDateString('zh-CN')} · 由 {post.author?.nickname || '匿名'}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center text-sm text-[#8B7355]/60 py-4">暂无赞过的帖子</div>
                            )}
                          </>
                        )}
                        {profileSubTab === 'favorites' && (
                          <>
                            {favoritedPostsList.length > 0 ? (
                              <div className="space-y-2 max-h-[216px] overflow-y-auto scrollbar-hide">
                                {favoritedPostsList.map((post) => (
                                  <div
                                    key={post.postId}
                                    onClick={() => handleOpenDashboardForumPost(post.postId)}
                                    className="flex items-center gap-3 rounded-lg bg-[#F9F8F6] p-3 transition-colors hover:bg-[#F3F1ED] cursor-pointer"
                                  >
                                    <span className="material-symbols-outlined text-[#420047] text-xl">star</span>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-serif text-sm text-[#2C2825]">{post.title}</p>
                                      <p className="mt-1 text-xs text-[#8B7355]/60">
                                        {new Date(post.createdAt).toLocaleDateString('zh-CN')}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center text-sm text-[#8B7355]/60 py-4">暂无收藏的帖子</div>
                            )}
                          </>
                        )}
                        {profileSubTab === 'notifications' && (
                          <>
                            {messagesList.length > 0 ? (
                              <div className="space-y-2 max-h-[216px] overflow-y-auto scrollbar-hide">
                                {messagesList.map((message) => {
                                  const getIconAndColor = () => {
                                    if (message.actionType === 'like') {
                                      return { icon: 'favorite', color: '#FF69B4' };
                                    } else if (message.actionType === 'favorite') {
                                      return { icon: 'star', color: '#D4A017' };
                                    } else if (message.actionType === 'comment' || message.actionType === 'reply') {
                                      return { icon: 'chat_bubble', color: '#8B7355' };
                                    }
                                    return { icon: 'mail', color: '#8B7355' };
                                  };

                                  const actionLabelMap: Record<MyForumMessageItem['actionType'], string> = {
                                    like: '点赞了',
                                    favorite: '收藏了',
                                    comment: '评论了',
                                    reply: '回复了',
                                  };

                                  const targetLabelMap: Record<MyForumMessageItem['targetType'], string> = {
                                    post: '帖子',
                                    comment: '评论',
                                  };

                                  const { icon, color } = getIconAndColor();
                                  return (
                                    <div
                                      key={message.messageId}
                                      onClick={() => void handleOpenMessage(message)}
                                      className={`group flex items-center gap-3 rounded-lg p-3 transition-colors cursor-pointer ${
                                        message.isRead
                                          ? 'bg-[#F9F8F6] hover:bg-[#F3F1ED]'
                                          : 'bg-[#420047]/5 hover:bg-[#420047]/10'
                                      }`}
                                    >
                                      <span className="material-symbols-outlined text-xl" style={{ color }}>
                                        {icon}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-serif text-sm text-[#2C2825] truncate">
                                          {message.senderNickname} {actionLabelMap[message.actionType]} 你的 {targetLabelMap[message.targetType]}
                                        </p>
                                        <p className="mt-1 truncate text-gray-500 text-sm">
                                          {message.contentSnippet}
                                        </p>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          try {
                                            await dismissMyMessage(message.messageId);
                                            setMessagesList(prev => prev.filter(m => m.messageId !== message.messageId));
                                            setForumSummary(prev => ({ ...prev, messages: Math.max(0, prev.messages - 1) }));
                                          } catch (err) {
                                            console.warn('移除消息失败', err);
                                          }
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-[#8B7355]/40 hover:text-[#420047] transition-all"
                                      >
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center text-sm text-[#8B7355]/60 py-4">暂无通知</div>
                            )}
                          </>
                        )}
                        {profileSubTab === 'directMessages' && (
                          <>
                            {directMessageConversations.length > 0 ? (
                              <div className="space-y-2 max-h-[216px] overflow-y-auto scrollbar-hide">
                                {directMessageConversations.map((conversation) => {
                                  const nickname = getDirectMessagePartnerName(conversation, user?.id);
                                  const preview = getDirectMessagePreview(conversation);
                                  const label = conversation.unreadCount > 0
                                    ? `${nickname} 给你发来了 ${conversation.unreadCount} 条私信`
                                    : `${nickname} 的私信会话`;

                                  return (
                                    <div
                                      key={conversation.conversationId}
                                      onClick={() => handleOpenDirectMessage(conversation)}
                                      className={`flex items-center gap-3 rounded-lg p-3 transition-colors cursor-pointer ${
                                        conversation.unreadCount > 0
                                          ? 'bg-[#420047]/5 hover:bg-[#420047]/10'
                                          : 'bg-[#F9F8F6] hover:bg-[#F3F1ED]'
                                      }`}
                                    >
                                      <span className="material-symbols-outlined text-xl text-[#420047]">mail</span>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="font-serif text-sm text-[#2C2825] truncate">{label}</p>
                                          {conversation.unreadCount > 0 && (
                                            <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-[#420047] px-1.5 py-0.5 text-[11px] text-white">
                                              {conversation.unreadCount}
                                            </span>
                                          )}
                                        </div>
                                        <p className="mt-1 truncate text-gray-500 text-sm">{preview}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-center text-sm text-[#8B7355]/60 py-4">暂无私信</div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </section>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="group mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-[#EAE7E1] bg-[#F9F8F6] px-4 py-3 text-left transition-all duration-300 hover:border-[#8B7355]/35 hover:shadow-sm relative z-10"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[#8B7355]">
                <MaterialIcon name="tune" className="text-[17px]" />
                <span className="text-[11px] font-medium uppercase tracking-[0.24em]">档案设置</span>
                <span className="rounded-full bg-[#F3F1ED] px-2 py-0.5 text-[9px] font-serif tracking-[0.18em] text-[#8B7355]/80">
                  全局
                </span>
              </div>
              <p className="mt-1 truncate text-[11px] font-serif leading-relaxed text-[#8B7355]/80">
                管理匹配与圈子都会用到的全局档案信息。
              </p>
            </div>
            <MaterialIcon name="east" className="shrink-0 text-[18px] text-[#8B7355] transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
          </div>
        </motion.div>
    
        {/* 右侧主内容区 */}
        <div className="flex-1 min-h-0 flex flex-col relative z-10 px-5 py-6 sm:px-6 sm:py-8 md:p-8 lg:p-10 xl:p-12 md:overflow-y-auto">

          {selectedDashboardForumPostId ? (
            <div className="absolute inset-3 z-20 md:left-32 md:right-5 md:bottom-5 md:top-5">
              <div className="h-full overflow-hidden rounded-[32px] border border-[#DCD8D0] bg-[#FCFBF8] p-2 shadow-[0_22px_70px_rgba(44,40,37,0.14)]">
                <ForumPostDetail
                  postId={selectedDashboardForumPostId}
                  embedded
                  backLabel="返回锦书"
                  onBack={handleCloseDashboardForumPost}
                  onMissing={handleCloseDashboardForumPost}
                />
              </div>
            </div>
          ) : (
            <>
          {surveyOutdated && !surveyBannerDismissed && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#420047]/10 border border-[#420047]/20 text-[#420047] text-sm px-5 py-3 rounded-xl mb-4 flex flex-wrap items-center gap-3 shrink-0 sm:flex-nowrap"
            >
              <MaterialIcon name="update" className="text-[18px]" />
              <span className="font-serif tracking-wide">问卷已更新，部分题目需要重新确认，请前往问卷页检查并重新提交。</span>
              <button type="button" onClick={() => navigate('/survey')} className="shrink-0 text-xs font-medium text-[#420047] hover:underline underline-offset-2 sm:ml-auto">去更新</button>
              <button type="button" onClick={() => setSurveyBannerDismissed(true)} className="shrink-0 text-[18px] opacity-60 hover:opacity-100" aria-label="关闭问卷更新提示">
                <MaterialIcon name="close" />
              </button>
            </motion.div>
          )}
    
          <div className="flex-[0.6] min-h-0 flex flex-col items-center justify-center pt-2 md:pt-4">
    
            {isLoadingMatch ? (
              <div className="flex items-center justify-center py-20">
                <MaterialIcon name="refresh" className="animate-spin text-4xl text-[#8B7355]" />
              </div>
            ) : visualState === 'PENDING' ? (
                            /* 等待匹配 / 已匹配等待揭晓 — 大倒计时 */
              <motion.div
                initial={{ opacity: 0, filter: 'blur(10px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 1 }}
                className="text-center relative w-full max-w-4xl px-2 py-8 md:px-4 md:py-12 lg:py-14"
              >
                <div className="text-[#8B7355] mb-6 font-serif text-base italic tracking-[0.24em] opacity-80 md:mb-8 md:text-lg lg:mb-10 lg:text-xl">
                  {matchData?.status === 'PENDING'
                    ? '「 距下一封锦书送达 」'
                    : '「 距下次匹配揭晓 」'}
                </div>
                <div className="font-serif flex items-end justify-center gap-3 text-[clamp(2.75rem,6vw,7rem)] leading-none text-[#2C2825] tracking-[-0.06em] md:gap-5 lg:gap-8">
                  {(['days', 'hours', 'minutes', 'seconds'] as const).map((unit, i) => (
                    <React.Fragment key={unit}>
                      {i > 0 && <span className="inline-block text-[0.62em] font-light text-[#EAE7E1] -translate-y-[0.18em]">:</span>}
                      <div className="flex flex-col items-center relative">
                        {unit === 'seconds' ? (
                          <motion.span
                            key={timeLeft[unit]}
                            initial={{ opacity: 0.5, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[#8B7355]"
                          >
                            {String(timeLeft[unit]).padStart(2, '0')}
                          </motion.span>
                        ) : (
                          <span>
                            {String(timeLeft[unit]).padStart(2, '0')}
                          </span>
                        )}
                        <span className="mt-3 text-[10px] tracking-[0.22em] uppercase font-sans text-[#8B7355] opacity-70 md:mt-4 md:text-xs md:tracking-[0.3em]">
                          {['Days', 'Hrs', 'Mins', 'Secs'][i]}
                        </span>
                      </div>
                    </React.Fragment>
                  ))}
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-32 bg-[#8B7355]/[0.02] blur-[40px] rounded-[100%] pointer-events-none -z-10" />
              </motion.div>
    
            ) : visualState === 'NEW_USER_WAITING' ? (
                              /* 新用户肯定未经历过匹配，静候初遇 */
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center w-full max-w-4xl px-2 py-8 md:px-4 md:py-12"
                >
                  <MaterialIcon name="hourglass_empty" className="mb-5 block text-4xl font-light text-[#8B7355]/40 md:text-5xl lg:text-6xl" />
                  <h2 className="mb-3 font-serif text-[clamp(2rem,4.5vw,4rem)] tracking-wide text-[#2C2825]">静候初遇</h2>
                  <p className="mb-8 text-[11px] tracking-widest text-[#8B7355]/60 font-serif md:text-xs">资料已归档，首次匹配运算中</p>
    
                  {countdown > 0 && (
                    <div>
                      <p className="mb-5 text-sm tracking-[0.24em] uppercase font-sans text-[#8B7355]/60 md:mb-6 md:tracking-[0.3em]">下次匹配倒计时</p>
                      <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-4 md:flex-nowrap md:gap-x-5">
                        {[timeLeft.days, timeLeft.hours, timeLeft.minutes, timeLeft.seconds].map((val, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && <span className="mb-4 text-2xl font-light text-[#8B7355]/30 md:mb-5 md:text-3xl">:</span>}
                            <div className="flex flex-col items-center">
                              <span className="w-[3.15rem] text-center font-serif text-[clamp(2.25rem,5.5vw,4.5rem)] tabular-nums text-[#2C2825] sm:w-14 md:w-16">
                                {String(val).padStart(2, '0')}
                              </span>
                              <span className="text-[10px] tracking-[0.25em] uppercase font-sans text-[#8B7355] mt-2 opacity-70">
                                {['Days', 'Hrs', 'Mins', 'Secs'][i]}
                              </span>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
    
            ) : visualState === 'NO_MATCH' ? (
                            /* 本周匹配已揭晓，未匹到 — 暂无锦书 + 小倒计时 */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center w-full max-w-4xl px-2 py-8 md:px-4 md:py-12"
              >
                <MaterialIcon name="inbox" className="mb-5 block text-4xl font-light text-[#8B7355]/40 md:text-5xl lg:text-6xl" />
                <h2 className="mb-3 font-serif text-[clamp(2rem,4.5vw,4rem)] tracking-wide text-[#2C2825]">本周暂无锦书</h2>
                <p className="text-[#8B7355] font-serif italic tracking-widest mb-2 text-base md:text-lg">{matchData?.message || '下周再试，缘分终会来'}</p>
                <p className="mb-8 text-[10px] tracking-widest text-[#8B7355]/40 font-serif md:text-xs">下周将自动继续参与，如需暂停请关闭左侧开关</p>
                {countdown > 0 && (
                  <div>
                    <p className="mb-5 text-sm tracking-[0.24em] uppercase font-sans text-[#8B7355]/60 md:mb-6 md:tracking-[0.3em]">下次匹配倒计时</p>
                    <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-4 md:flex-nowrap md:gap-x-5">
                      {[timeLeft.days, timeLeft.hours, timeLeft.minutes, timeLeft.seconds].map((val, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="mb-4 text-2xl font-light text-[#8B7355]/30 md:mb-5 md:text-3xl">:</span>}
                          <div className="flex flex-col items-center">
                            <span className="w-[3.15rem] text-center font-serif text-[clamp(2.25rem,5.5vw,4.5rem)] tabular-nums text-[#2C2825] sm:w-14 md:w-16">
                              {String(val).padStart(2, '0')}
                            </span>
                            <span className="text-[10px] tracking-[0.25em] uppercase font-sans text-[#8B7355] mt-2 opacity-70">
                              {['Days', 'Hrs', 'Mins', 'Secs'][i]}
                            </span>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
    
            ) : visualState === 'REVEALED' ? (
                            /* 锦书已到 */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="z-10 flex flex-col items-center px-6 py-6 md:px-10 md:py-8"
              >
                <div className="w-20 h-20 md:w-28 md:h-28 rounded-full flex items-center justify-center mb-6 relative">
                  <div className="absolute inset-0 bg-[#420047]/5 rounded-full scale-150 blur-xl" />
                  <div className="absolute inset-4 rounded-full border border-[#420047]/30 border-dashed animate-[spin_20s_linear_infinite]" />
                  <MaterialIcon name="mail_lock" className="text-5xl md:text-6xl text-[#420047]" />
                </div>
                <h1 className="mb-4 font-serif text-[clamp(2.4rem,5vw,4.5rem)] tracking-wide text-[#2C2825] md:mb-6">锦书已送达</h1>
                <p className="mb-8 text-center text-base tracking-widest text-[#8B7355] font-serif italic md:mb-10 md:text-lg lg:text-xl">一封写给你的信，正静候开启。</p>
                <button
                  type="button"
                  onClick={() => navigate('/reveal')}
                  className="bg-[#420047] text-[#FCFBF8] px-10 md:px-12 py-3 md:py-4 text-sm md:text-base tracking-[0.2em] shadow-lg shadow-[#420047]/20 hover:shadow-xl hover:shadow-[#420047]/30 hover:-translate-y-1 transition-all duration-300"
                >
                  揭开火漆
                </button>
                <p className="text-[10px] md:text-xs text-[#8B7355]/50 tracking-widest font-serif mt-6 text-center">
                  下周将自动继续参与匹配，如需暂停请关闭左侧开关
                </p>
              </motion.div>
    
            ) : (
                            /* 默认/加载失败态 — 显示倒计时占位 */
              <div className="text-center py-20 text-[#8B7355] font-serif tracking-widest italic">
                正在查询匹配状态…
              </div>
            )}
          </div>
    
          {/* 信封堆叠区 (Archive) */}
          <div className="flex-[0.4] min-h-[180px] flex flex-col items-center justify-end pb-4 md:pb-6 mt-4 md:mt-8">
            <div
              className="relative h-[140px] w-[260px] cursor-pointer group flex justify-center items-end sm:h-[160px] sm:w-[300px] md:h-[170px] md:w-[320px] lg:h-[180px] lg:w-[340px]"
              onMouseEnter={() => setIsStackHovered(true)}
              onMouseLeave={() => setIsStackHovered(false)}
              onClick={() => history.length > 0 && setIsArchiveDrawerOpen(true)}
            >
              {(history.length > 0 ? history.slice(0, 3) : ([{matchId: 'empty-1'}, {matchId: 'empty-2'}, {matchId: 'empty-3'}] as any[])).map((item: any, index: number) => (
                <motion.div
                  key={item.matchId}
                  custom={index}
                  variants={envelopeVariants}
                  initial="idle"
                  animate={isStackHovered ? 'hover' : 'idle'}
                  className="absolute bottom-0 h-[115px] w-[210px] bg-[#EBE8E3] shadow-[0_6px_24px_rgba(0,0,0,0.08)] flex justify-center items-center overflow-hidden border border-[#DCD8D0] group-hover:brightness-105 sm:h-[130px] sm:w-[240px] md:h-[145px] md:w-[260px] lg:h-[150px] lg:w-[280px]"
                >
                  <div className="absolute inset-x-0 bottom-0 h-full bg-[#F3F1ED] origin-bottom scale-x-[1.01]" style={{ clipPath: 'polygon(50% 45%, 100% 100%, 0% 100%)' }} />
                  <div className="absolute inset-y-0 left-0 w-full bg-[#EBE8E3]" style={{ clipPath: 'polygon(0 0, 50% 50%, 0 100%)' }} />
                  <div className="absolute inset-y-0 right-0 w-full bg-[#EAE7E1]" style={{ clipPath: 'polygon(100% 0, 50% 50%, 100% 100%)' }} />
                  <div className="absolute inset-x-0 top-0 h-[60%] bg-[#FCFBF8] shadow-[0_2px_8px_rgba(0,0,0,0.05)] origin-top z-10 border-b border-[#EAE7E1]/50" style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
                  {index === 0 && (
                    <>
                      <div className="absolute top-[48%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#DCD8D0] border border-[#C5C0B5] flex items-center justify-center p-1 z-20 shadow-sm opacity-80 mix-blend-multiply">
                        <div className="absolute inset-1.5 border border-dashed border-[#A8A296] rounded-full" />
                      </div>
                      <div className="absolute top-[65%] md:top-1/2 left-1/2 -translate-x-1/2 md:mt-8 z-10">
                        <span className="text-[10px] md:text-[12px] tracking-[0.2em] text-[#8B7355]/40 font-serif whitespace-nowrap">NJU Match Archive</span>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}

            </div>
    
            <p className={`text-[#8B7355] mt-6 md:mt-8 tracking-[0.3em] opacity-50 hover:opacity-100 transition-opacity font-serif flex items-center gap-2 md:gap-3 ${history.length > 0 ? 'text-[11px]' : 'text-sm md:text-base'}`}>
              <MaterialIcon name="touch_app" className={history.length > 0 ? 'text-[14px]' : 'text-[18px]'} />
              {history.length > 0 ? '点击翻阅旧时光档案' : '暂无档案可阅'}
            </p>
          </div>
            </>
          )}
        </div>
      </div>
    
      {/* ============================================================== */}
      {/* 抽屉 1: 交际信笺 (Friend Requests & Send Form)                */}
      {/* ============================================================== */}
      <AnimatePresence>
        {isFriendDrawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} onClick={() => setIsFriendDrawerOpen(false)} className="fixed inset-0 bg-[#2C2825]/20 backdrop-blur-[2px] z-40" />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 1 }}
              className="fixed left-0 md:left-[60px] top-0 bottom-0 w-full md:w-[480px] bg-[#F3F1ED] shadow-[20px_0_80px_rgba(0,0,0,0.15)] z-50 flex flex-col border-r border-[#8B7355]/20"
            >
              <div className="px-8 py-10 flex justify-between items-center relative z-10">
                <div className="flex flex-col gap-1">
                  <h2 className="font-serif text-2xl text-[#2C2825] tracking-widest">交际信笺</h2>
                  <p className="text-[10px] tracking-[0.3em] uppercase text-[#8B7355] font-serif italic border-b border-[#8B7355]/30 pb-1 w-fit">Letters & Requests</p>
                </div>
                <button onClick={() => setIsFriendDrawerOpen(false)} className="w-10 h-10 flex items-center justify-center text-[#8B7355] hover:text-[#2C2825] transition-colors">
                  <MaterialIcon name="close" className="text-[24px] font-thin" />
                </button>
              </div>
    
              <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-10 flex flex-col gap-8">
                
                {/* 发信表单：主动递交申请 */}
                <div className="bg-[#FCFBF8] border border-[#EAE7E1] rounded-lg p-5 shadow-sm">
                  <h3 className="font-serif text-sm tracking-widest text-[#2C2825] mb-4 flex items-center gap-2">
                    <MaterialIcon name="draw" className="text-[16px] text-[#8B7355]" />
                    投递交际申请
                  </h3>
                  <form onSubmit={handleSendFriendRequest} className="space-y-3">
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="输入圈子名称，如 守望先锋圈"
                        required
                        value={friendCircleQuery}
                        onChange={(e) => setFriendCircleQuery(e.target.value)}
                        className="w-full text-sm bg-[#F3F1ED] border border-transparent focus:border-[#8B7355]/30 px-3 py-2.5 rounded outline-none placeholder:text-[#8B7355]/50 transition-colors"
                      />
                      {selectedFriendCircle ? (
                        <div className="flex items-center justify-between gap-3 rounded-md border border-[#8B7355]/20 bg-[#8B7355]/5 px-3 py-2 text-xs text-[#2C2825]">
                          <span className="font-serif">已匹配到：{selectedFriendCircle.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setFriendCircleQuery('');
                              setSelectedFriendCircle(null);
                              setCircleMembers([]);
                              setFriendTargetQuery('');
                              setSelectedFriendTarget(null);
                            }}
                            className="shrink-0 text-[#420047] hover:underline underline-offset-2"
                          >
                            重选
                          </button>
                        </div>
                      ) : friendCircleQuery.trim() ? (
                        loadingJoinedCircles ? (
                          <p className="text-[11px] font-serif text-[#8B7355]/70">正在检索你已加入的圈子…</p>
                        ) : matchedCircles.length === 0 ? (
                          <p className="text-[11px] font-serif text-[#B94A48]">未找到你已加入的相关圈子，请检查名称。</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {matchedCircles.slice(0, 6).map((circle) => (
                              <button
                                key={circle.id}
                                type="button"
                                onClick={() => handleSelectFriendCircle(circle)}
                                className="rounded-full border border-[#8B7355]/20 bg-[#F8F5F0] px-3 py-1.5 text-[11px] font-serif tracking-[0.12em] text-[#8B7355] transition-colors hover:border-[#420047]/30 hover:text-[#420047]"
                              >
                                {circle.name}
                              </button>
                            ))}
                          </div>
                        )
                      ) : (
                        <p className="text-[11px] font-serif text-[#8B7355]/70">支持直接输入圈子中文名，唯一时会自动匹配。</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder={selectedFriendCircle ? '输入对方在该圈的昵称，重名时点选确认' : '请先确认结缘圈子'}
                        required
                        disabled={!selectedFriendCircle}
                        value={friendTargetQuery}
                        onChange={(e) => setFriendTargetQuery(e.target.value)}
                        className="w-full text-sm bg-[#F3F1ED] border border-transparent focus:border-[#8B7355]/30 px-3 py-2.5 rounded outline-none placeholder:text-[#8B7355]/50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      {selectedFriendCircle ? (
                        loadingCircleMembers ? (
                          <p className="text-[11px] font-serif text-[#8B7355]/70">正在翻找 {selectedFriendCircle.name} 的圈内同窗…</p>
                        ) : selectedFriendTarget ? (
                          <div className="flex items-center justify-between gap-3 rounded-md border border-[#420047]/15 bg-[#420047]/5 px-3 py-2 text-xs text-[#2C2825]">
                            <div className="min-w-0">
                              <div className="font-serif text-[#2C2825]">已确认：{selectedFriendTarget.nickname || '未命名同窗'}</div>
                              <div className="mt-1 truncate text-[10px] text-[#8B7355]">{getMemberHint(selectedFriendTarget)}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFriendTargetQuery('');
                                setSelectedFriendTarget(null);
                              }}
                              className="shrink-0 text-[#420047] hover:underline underline-offset-2"
                            >
                              重选
                            </button>
                          </div>
                        ) : friendTargetQuery.trim() ? (
                          matchedMembers.length === 0 ? (
                            <p className="text-[11px] font-serif text-[#B94A48]">这个圈子里暂时没找到对应昵称。</p>
                          ) : (
                            <div className="space-y-2">
                              {matchedMembers.slice(0, 6).map((member) => (
                                <button
                                  key={member.userId}
                                  type="button"
                                  onClick={() => handleSelectFriendTarget(member)}
                                  className="flex w-full items-center gap-3 rounded-lg border border-[#EAE7E1] bg-[#F8F5F0] px-3 py-2 text-left transition-colors hover:border-[#420047]/20 hover:bg-white"
                                >
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#EAE7E1] bg-white text-sm font-serif text-[#8B7355]">
                                    {member.avatarUrl ? (
                                      <img src={member.avatarUrl} alt={member.nickname || '同窗头像'} className="h-full w-full object-cover" />
                                    ) : (
                                      (member.nickname?.[0] || '?')
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-serif text-sm text-[#2C2825]">{member.nickname || '未命名同窗'}</div>
                                    <div className="mt-1 truncate text-[10px] text-[#8B7355]">{getMemberHint(member)}</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )
                        ) : (
                          <p className="text-[11px] font-serif text-[#8B7355]/70">
                            已载入 {circleMembers.length} 位圈内同窗，输入昵称即可搜索；若重名，请从候选里点选确认。
                          </p>
                        )
                      ) : null}
                    </div>
                    <textarea
                      placeholder="写句问候，述说结识之意..." rows={3}
                      value={friendMessage} onChange={(e) => setFriendMessage(e.target.value)}
                      className="w-full text-sm bg-[#F3F1ED] border border-transparent focus:border-[#8B7355]/30 px-3 py-2.5 rounded outline-none placeholder:text-[#8B7355]/50 resize-none transition-colors"
                    />
                    <button
                      type="submit" disabled={sendingFriend}
                      className="w-full mt-2 py-2.5 bg-[#420047] text-white text-xs tracking-widest rounded hover:bg-[#5C0064] transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {sendingFriend ? '寄送中...' : '封缄并投递'}
                    </button>
                  </form>
                </div>
    
                <div className="w-full h-[1px] bg-[#EAE7E1] relative">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#F3F1ED] px-3 text-[10px] text-[#8B7355] font-serif tracking-widest">待阅信件</span>
                </div>
    
                {/* 收到的好友申请 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[11px] tracking-widest text-[#8B7355] font-serif">
                    <MaterialIcon name="diversity_3" className="text-[14px]" />
                    待回交际申请
                  </div>
                  {loadingFriends ? (
                    <div className="p-6 text-center text-[#8B7355]/60 text-sm italic font-serif">正翻寻信笺...</div>
                  ) : friendRequests.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-[#8B7355]/30 rounded-lg">
                      <p className="text-[#8B7355]/60 text-xs tracking-widest font-serif italic">尚无待阅之信</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {friendRequests.map((req) => (
                        <div key={req.request_id} className="p-4 bg-[#FCFBF8] border border-[#EAE7E1] shadow-sm rounded-lg flex flex-col gap-3 transition-all hover:shadow-md">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 shrink-0 bg-[#EAE7E1] rounded-full flex items-center justify-center text-[#8B7355] font-serif overflow-hidden">
                              {req.avatar_url ? <img src={req.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : (req.nickname?.[0] || '?')}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-[#2C2825]">{req.nickname || '神秘同窗'}</h4>
                              <p className="text-[10px] text-[#8B7355] mt-0.5">来源圈子: {req.circle_id || '未知'}</p>
                            </div>
                            <span className="text-[10px] text-[#8B7355]/60 font-serif">{new Date(req.created_at).toLocaleDateString()}</span>
                          </div>
                          
                          {req.message && (
                            <div className="bg-[#F3F1ED] p-2.5 rounded text-xs text-[#2C2825] italic font-serif relative">
                              <span className="absolute -top-1 -left-1 text-2xl text-[#8B7355]/20 font-serif leading-none">&quot;</span>
                              {req.message}
                            </div>
                          )}

                          {req.card_preview && (
                            <button
                              type="button"
                              onClick={() => openSnapshotPreview(req.card_preview, req.nickname || '交际申请附带名片', `${req.circle_id || '该圈子'} · 公开态名片快照`)}
                              className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-[#420047]/20 bg-[#420047]/5 px-3 py-1.5 text-[11px] font-serif tracking-[0.2em] text-[#420047] transition hover:bg-[#420047]/10"
                            >
                              <MaterialIcon name="badge" className="text-[15px]" />
                              翻阅附带名片
                            </button>
                          )}
                          
                          <div className="flex gap-2 mt-1">
                            <button onClick={() => handleFriendAction(req.request_id, 'accept')} className="flex-1 py-1.5 bg-[#8B7355] text-white text-xs tracking-widest rounded hover:bg-[#6e5840] transition-colors">欣然结缘</button>
                            <button onClick={() => handleFriendAction(req.request_id, 'reject')} className="flex-1 py-1.5 bg-white border border-[#EAE7E1] text-[#8B7355] text-xs tracking-widest rounded hover:bg-[#F3F1ED] transition-colors">婉言谢绝</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] tracking-widest text-[#8B7355] font-serif">
                      <MaterialIcon name="celebration" className="text-[14px]" />
                      好友申请回音
                    </div>
                    {friendRepliesToShow.length > 1 && (
                      <button type="button" onClick={() => toggleReplySection('friend')} className="text-[10px] font-serif tracking-widest text-[#420047] hover:text-[#5C0064]">
                        {expandedReplySections.friend ? '收起' : `展开近${friendRepliesToShow.length}条`}
                      </button>
                    )}
                  </div>
                  {loadingFriends ? (
                    <div className="p-6 text-center text-[#8B7355]/60 text-sm italic font-serif">正翻寻回音...</div>
                  ) : friendRepliesToShow.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-[#8B7355]/30 rounded-lg">
                      <p className="text-[#8B7355]/60 text-xs tracking-widest font-serif italic">还没有新的结缘回音</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleFriendReplies.map((req) => {
                        const sourceLabel = req.circle_name || req.circle_id || '该圈子';
                        const statusView = getFriendReplyStatusView(req.status, sourceLabel);
                        return (
                          <div key={friendReplyKey(req)} className="p-4 bg-[#FCFBF8] border border-[#EAE7E1] shadow-sm rounded-lg flex flex-col gap-3 transition-all hover:shadow-md">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 shrink-0 bg-[#EAE7E1] rounded-full flex items-center justify-center text-[#8B7355] font-serif overflow-hidden">
                                {req.avatar_url ? <img src={req.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : (req.nickname?.[0] || '?')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-bold text-[#2C2825]">{req.nickname || '神秘同窗'}</h4>
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-serif tracking-widest ${statusPillClass(statusView.tone)}`}>
                                    <MaterialIcon name={statusView.icon} className="text-[13px]" />
                                    {statusView.label}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#8B7355] mt-0.5 truncate">
                                  {statusView.text}
                                </p>
                              </div>
                              <span className="text-[10px] text-[#8B7355]/60 font-serif shrink-0">{new Date(req.responded_at).toLocaleDateString()}</span>
                            </div>

                            {statusView.canOpenCard && req.card_preview && (
                              <button
                                type="button"
                                onClick={() => openSnapshotPreview(req.card_preview, req.nickname || '结缘回音附带名片', `${sourceLabel} · 公开态名片`)}
                                className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-[#420047]/20 bg-[#420047]/5 px-3 py-1.5 text-[11px] font-serif tracking-[0.2em] text-[#420047] transition hover:bg-[#420047]/10"
                              >
                                <MaterialIcon name="draft_orders" className="text-[15px]" />
                                点开回音里的名片
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="w-full h-[1px] bg-[#EAE7E1] relative">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#F3F1ED] px-3 text-[10px] text-[#8B7355] font-serif tracking-widest">同游邀约</span>
                </div>

                {/* 收到的组队申请 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[11px] tracking-widest text-[#8B7355] font-serif">
                    <MaterialIcon name="group_add" className="text-[14px]" />
                    待回同游拜帖
                  </div>
                  {loadingTeamUpApplications ? (
                    <div className="p-6 text-center text-[#8B7355]/60 text-sm italic font-serif">正翻寻同游拜帖...</div>
                  ) : teamUpApplicationRequests.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-[#8B7355]/30 rounded-lg">
                      <p className="text-[#8B7355]/60 text-xs tracking-widest font-serif italic">尚无待回同游拜帖</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {teamUpApplicationRequests.map((req) => {
                        const snapshotPreview = teamupApplicationSnapshotToPreview(req.cardSnapshot);
                        const requestKey = `${req.circleId}:${req.teamupId}:${req.id}`;
                        const isReviewing = reviewingTeamUpApplicationId === requestKey;
                        const isWaitlistApplication = req.applicationType === 'waitlist';
                        return (
                          <div key={requestKey} className="p-4 bg-[#FCFBF8] border border-[#EAE7E1] shadow-sm rounded-lg flex flex-col gap-3 transition-all hover:shadow-md">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 shrink-0 bg-[#EAE7E1] rounded-full flex items-center justify-center text-[#8B7355] font-serif overflow-hidden">
                                {req.applicant.avatarUrl ? <img src={req.applicant.avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : (req.applicant.nickname?.[0] || '?')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-[#2C2825]">{req.applicant.nickname || '神秘同窗'}</h4>
                                <p className="text-[10px] text-[#8B7355] mt-0.5 truncate">
                                  {isWaitlistApplication ? '申请候补' : '申请加入'}「{req.teamupTitle}」 · {req.circleName}
                                  {isWaitlistApplication && req.waitlistPosition ? ` · 第 ${req.waitlistPosition} 位` : ''}
                                </p>
                              </div>
                              <span className="text-[10px] text-[#8B7355]/60 font-serif">{new Date(req.createdAt).toLocaleDateString()}</span>
                            </div>

                            {req.applicationNote && (
                              <div className="bg-[#F3F1ED] p-2.5 rounded text-xs text-[#2C2825] italic font-serif relative">
                                <span className="absolute -top-1 -left-1 text-2xl text-[#8B7355]/20 font-serif leading-none">&quot;</span>
                                {req.applicationNote}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2">
                              {snapshotPreview && (
                                <button
                                  type="button"
                                  onClick={() => openSnapshotPreview(snapshotPreview, req.applicant.nickname || '同游拜帖附带名片', `${req.circleName} · ${req.teamupTitle} · ${snapshotPreview.previewMode === 'friend' ? '好友态' : '公开态'}名片快照`)}
                                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#420047]/20 bg-[#420047]/5 px-3 py-1.5 text-[11px] font-serif tracking-[0.2em] text-[#420047] transition hover:bg-[#420047]/10"
                                >
                                  <MaterialIcon name="badge" className="text-[15px]" />
                                  翻阅附带名片
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setIsFriendDrawerOpen(false);
                                  navigate(`/circles/${req.circleId}/teamups/${req.teamupId}`);
                                }}
                                className="inline-flex items-center justify-center gap-1 rounded-full border border-[#EAE7E1] bg-white px-3 py-1.5 text-[11px] font-serif tracking-[0.2em] text-[#8B7355] transition hover:bg-[#F3F1ED]"
                              >
                                前往卷宗
                                <MaterialIcon name="arrow_forward" className="text-[14px]" />
                              </button>
                            </div>

                            <div className="flex gap-2 mt-1">
                              <button disabled={Boolean(reviewingTeamUpApplicationId)} onClick={() => handleTeamUpApplicationAction(req, 'approve')} className="flex-1 py-1.5 bg-[#8B7355] text-white text-xs tracking-widest rounded hover:bg-[#6e5840] transition-colors disabled:opacity-50">{isReviewing ? '处理中...' : (isWaitlistApplication ? '通过候补' : '准入同游')}</button>
                              <button disabled={Boolean(reviewingTeamUpApplicationId)} onClick={() => handleTeamUpApplicationAction(req, 'reject')} className="flex-1 py-1.5 bg-white border border-[#EAE7E1] text-[#8B7355] text-xs tracking-widest rounded hover:bg-[#F3F1ED] transition-colors disabled:opacity-50">婉言谢绝</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] tracking-widest text-[#8B7355] font-serif">
                      <MaterialIcon name="fact_check" className="text-[14px]" />
                      同游拜帖回音
                    </div>
                    {teamupRepliesToShow.length > 1 && (
                      <button type="button" onClick={() => toggleReplySection('teamup')} className="text-[10px] font-serif tracking-widest text-[#420047] hover:text-[#5C0064]">
                        {expandedReplySections.teamup ? '收起' : `展开近${teamupRepliesToShow.length}条`}
                      </button>
                    )}
                  </div>
                  {loadingTeamUpApplications ? (
                    <div className="p-6 text-center text-[#8B7355]/60 text-sm italic font-serif">正翻寻同游回音...</div>
                  ) : teamupRepliesToShow.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-[#8B7355]/30 rounded-lg">
                      <p className="text-[#8B7355]/60 text-xs tracking-widest font-serif italic">还没有新的同游回音</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleTeamupReplies.map((req) => {
                        const approved = req.status === 'approved';
                        const isWaitlistReply = req.applicationType === 'waitlist';
                        const replyVerb = approved
                          ? (isWaitlistReply ? (req.waitlistJoinedAt ? '候补已补位' : '候补已通过') : '已准入')
                          : (isWaitlistReply ? '候补已婉拒' : '已婉拒');
                        return (
                          <div key={teamupReplyKey(req)} className="p-4 bg-[#FCFBF8] border border-[#EAE7E1] shadow-sm rounded-lg flex flex-col gap-3 transition-all hover:shadow-md">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 shrink-0 bg-[#EAE7E1] rounded-full flex items-center justify-center text-[#8B7355] font-serif overflow-hidden">
                                {req.leader.avatarUrl ? <img src={req.leader.avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : (req.leader.nickname?.[0] || '?')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-[#2C2825]">{req.leader.nickname || '组队发起人'}</h4>
                                <p className="text-[10px] text-[#8B7355] mt-0.5 truncate">
                                  {replyVerb}你{isWaitlistReply ? '候补' : '加入'}「{req.teamupTitle}」 · {req.circleName || '圈内'}
                                </p>
                              </div>
                              <span className="text-[10px] text-[#8B7355]/60 font-serif shrink-0">{new Date(req.respondedAt).toLocaleDateString()}</span>
                            </div>

                            {req.reviewNote && (
                              <div className="bg-[#F3F1ED] p-2.5 rounded text-xs text-[#2C2825] italic font-serif relative">
                                <span className="absolute -top-1 -left-1 text-2xl text-[#8B7355]/20 font-serif leading-none">&quot;</span>
                                {req.reviewNote}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setIsFriendDrawerOpen(false);
                                navigate(`/circles/${req.circleId}/teamups/${req.teamupId}`);
                              }}
                              className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-[#420047]/20 bg-[#420047]/5 px-3 py-1.5 text-[11px] font-serif tracking-[0.2em] text-[#420047] transition hover:bg-[#420047]/10"
                            >
                              <MaterialIcon name="map" className="text-[15px]" />
                              查看同游卷宗
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="w-full h-[1px] bg-[#EAE7E1] relative">
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#F3F1ED] px-3 text-[10px] text-[#8B7355] font-serif tracking-widest">联络印记</span>
                </div>

                {/* 收到的联系方式申请 */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-[11px] tracking-widest text-[#8B7355] font-serif">
                    <MaterialIcon name="contact_mail" className="text-[14px]" />
                    待回应联络印记
                  </div>
                  {loadingContactUnlockRequests ? (
                    <div className="p-6 text-center text-[#8B7355]/60 text-sm italic font-serif">正翻检联络印记...</div>
                  ) : contactUnlockRequests.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-[#8B7355]/30 rounded-lg">
                      <p className="text-[#8B7355]/60 text-xs tracking-widest font-serif italic">尚无待回印记</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {contactUnlockRequests.map((req) => (
                        <div key={req.request_id} className="p-4 bg-[#FCFBF8] border border-[#EAE7E1] shadow-sm rounded-lg flex flex-col gap-3 transition-all hover:shadow-md">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 shrink-0 bg-[#EAE7E1] rounded-full flex items-center justify-center text-[#8B7355] font-serif overflow-hidden">
                              {req.avatar_url ? <img src={req.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : (req.nickname?.[0] || '?')}
                            </div>
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-[#2C2825]">{req.nickname || '神秘同窗'}</h4>
                              <p className="text-[10px] text-[#8B7355] mt-0.5">
                                申请来源: {getContactUnlockSourceLabel(req)}
                              </p>
                            </div>
                            <span className="text-[10px] text-[#8B7355]/60 font-serif">{new Date(req.created_at).toLocaleDateString()}</span>
                          </div>

                          <div className="bg-[#F3F1ED] p-2.5 rounded text-xs text-[#2C2825] italic font-serif relative">
                            <span className="absolute -top-1 -left-1 text-2xl text-[#8B7355]/20 font-serif leading-none">&quot;</span>
                            {req.message || '对方想将你的联络印记妥帖收进自己的名册。'}
                          </div>

                          {req.card_preview && (
                            <button
                              type="button"
                              onClick={() => openSnapshotPreview(req.card_preview, req.nickname || '联络申请附带名片', `${getContactUnlockSourceLabel(req)} · 好友态名片快照`)}
                              className="inline-flex items-center justify-center gap-2 self-start rounded-full border border-[#420047]/20 bg-[#420047]/5 px-3 py-1.5 text-[11px] font-serif tracking-[0.2em] text-[#420047] transition hover:bg-[#420047]/10"
                            >
                              <MaterialIcon name="badge" className="text-[15px]" />
                              翻阅附带名片
                            </button>
                          )}

                          <div className="flex gap-2 mt-1">
                            <button onClick={() => void openCircleContactApproval(req)} className="flex-1 py-1.5 bg-[#8B7355] text-white text-xs tracking-widest rounded hover:bg-[#6e5840] transition-colors">应允交换</button>
                            <button onClick={() => void handleContactUnlockAction(req.request_id, 'reject')} className="flex-1 py-1.5 bg-white border border-[#EAE7E1] text-[#8B7355] text-xs tracking-widest rounded hover:bg-[#F3F1ED] transition-colors">暂不交换</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-[11px] tracking-widest text-[#8B7355] font-serif">
                      <MaterialIcon name="mark_email_read" className="text-[14px]" />
                      联系方式申请回音
                    </div>
                    {contactRepliesToShow.length > 1 && (
                      <button type="button" onClick={() => toggleReplySection('contact')} className="text-[10px] font-serif tracking-widest text-[#420047] hover:text-[#5C0064]">
                        {expandedReplySections.contact ? '收起' : `展开近${contactRepliesToShow.length}条`}
                      </button>
                    )}
                  </div>
                  {loadingContactUnlockRequests ? (
                    <div className="p-6 text-center text-[#8B7355]/60 text-sm italic font-serif">正翻寻联络回音...</div>
                  ) : contactRepliesToShow.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-[#8B7355]/30 rounded-lg">
                      <p className="text-[#8B7355]/60 text-xs tracking-widest font-serif italic">还没有新的联络回音</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleContactReplies.map((req) => {
                        const sourceLabel = getContactUnlockSourceLabel(req);
                        const statusView = getContactReplyStatusView(req.status, sourceLabel);
                        return (
                          <div key={contactReplyKey(req)} className="p-4 bg-[#FCFBF8] border border-[#EAE7E1] shadow-sm rounded-lg flex flex-col gap-3 transition-all hover:shadow-md">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 shrink-0 bg-[#EAE7E1] rounded-full flex items-center justify-center text-[#8B7355] font-serif overflow-hidden">
                                {req.avatar_url ? <img src={req.avatar_url} alt="avatar" className="w-full h-full object-cover" /> : (req.nickname?.[0] || '?')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-sm font-bold text-[#2C2825]">{req.nickname || '神秘同窗'}</h4>
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-serif tracking-widest ${statusPillClass(statusView.tone)}`}>
                                    <MaterialIcon name={statusView.icon} className="text-[13px]" />
                                    {statusView.label}
                                  </span>
                                </div>
                                <p className="text-[10px] text-[#8B7355] mt-0.5 truncate">
                                  {statusView.text}
                                </p>
                              </div>
                              <span className="text-[10px] text-[#8B7355]/60 font-serif shrink-0">{new Date(req.responded_at).toLocaleDateString()}</span>
                            </div>

                            {statusView.canViewContacts && (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsFriendDrawerOpen(false);
                                    setIsContactsDrawerOpen(true);
                                    void loadAddressBook();
                                  }}
                                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#420047]/20 bg-[#420047]/5 px-3 py-1.5 text-[11px] font-serif tracking-[0.2em] text-[#420047] transition hover:bg-[#420047]/10"
                                >
                                  <MaterialIcon name="contacts" className="text-[15px]" />
                                  去名录查看
                                </button>
                                {statusView.canRequestMore && req.source_type === 'circle' && req.circle_id && (
                                  <button
                                    type="button"
                                    onClick={() => void handleRequestMoreCircleContacts(req)}
                                    disabled={requestingMoreContactReplyId === req.request_id}
                                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[#8B7355]/25 bg-white px-3 py-1.5 text-[11px] font-serif tracking-[0.2em] text-[#8B7355] transition hover:bg-[#F3F1ED] disabled:cursor-wait disabled:opacity-60"
                                  >
                                    <MaterialIcon name={requestingMoreContactReplyId === req.request_id ? 'progress_activity' : 'add'} className={`text-[15px] ${requestingMoreContactReplyId === req.request_id ? 'animate-spin' : ''}`} />
                                    申请其他联系方式
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {approvingContactRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2C2825]/40 px-4 backdrop-blur-sm"
            onClick={closeCircleContactApproval}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-lg rounded-2xl border border-[#EAE7E1] bg-[#FCFBF8] p-6 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-serif uppercase tracking-[0.25em] text-[#8B7355]">
                    {getContactUnlockSourceLabel(approvingContactRequest)}
                  </p>
                  <h3 className="mt-1 font-serif text-2xl tracking-widest text-[#2C2825]">开放圈内联系方式</h3>
                  <p className="mt-2 text-sm font-serif leading-relaxed text-[#8B7355]">
                    {approvingContactRequest.nickname || '这位同窗'} 申请查看你的联系方式，请选择本次开放的项目。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeCircleContactApproval}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#8B7355] transition-colors hover:bg-[#F3F1ED] hover:text-[#2C2825]"
                >
                  <MaterialIcon name="close" className="text-[21px]" />
                </button>
              </div>

              {loadingCircleContactOptions ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#8B7355]/25 py-10 text-sm font-serif text-[#8B7355]">
                  <MaterialIcon name="progress_activity" className="animate-spin text-[18px]" />
                  正在读取圈内联系方式
                </div>
              ) : circleContactOptions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#8B7355]/30 px-5 py-8 text-center">
                  <MaterialIcon name="contacts" className="mx-auto mb-3 text-[28px] text-[#8B7355]/50" />
                  <p className="text-sm font-serif leading-relaxed text-[#8B7355]">
                    当前没有可开放的圈内联系方式。请先在该圈子的「圈内联系方式」中添加或启用。
                  </p>
                  {approvingContactRequest.circle_id && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetCircleId = approvingContactRequest.circle_id;
                        closeCircleContactApproval();
                        setIsFriendDrawerOpen(false);
                        if (targetCircleId) navigate(`/circles/${targetCircleId}`);
                      }}
                      className="mt-5 rounded-full border border-[#420047] px-5 py-2 text-xs font-serif tracking-widest text-[#420047] transition-colors hover:bg-[#420047] hover:text-[#FCFBF8]"
                    >
                      前往圈子
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {circleContactOptions.map((contact) => {
                    const selected = selectedCircleContactIds.includes(contact.id);
                    return (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => toggleSelectedCircleContact(contact.id)}
                        className={`flex w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors ${
                          selected
                            ? 'border-[#420047]/45 bg-[#420047]/5'
                            : 'border-[#EAE7E1] bg-white hover:bg-[#F8F5F0]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-serif font-bold tracking-widest text-[#2C2825]">{contact.label}</p>
                          <p className="mt-1 break-all text-sm text-[#5a544e]">{contact.value}</p>
                        </div>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          selected ? 'border-[#420047] bg-[#420047] text-[#FCFBF8]' : 'border-[#8B7355]/35 text-transparent'
                        }`}>
                          <MaterialIcon name="check" className="text-[16px]" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeCircleContactApproval}
                  disabled={submittingCircleContactApproval}
                  className="rounded-full border border-[#EAE7E1] px-5 py-2 text-[13px] font-serif tracking-widest text-[#8B7355] transition-colors hover:bg-[#F3F1ED] disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void confirmCircleContactApproval()}
                  disabled={loadingCircleContactOptions || circleContactOptions.length === 0 || submittingCircleContactApproval}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#420047] bg-[#420047] px-5 py-2 text-[13px] font-serif tracking-widest text-[#FCFBF8] transition-colors hover:bg-[#2A002D] disabled:opacity-50"
                >
                  <MaterialIcon name={submittingCircleContactApproval ? 'progress_activity' : 'lock_open'} className={`text-[16px] ${submittingCircleContactApproval ? 'animate-spin' : ''}`} />
                  {submittingCircleContactApproval ? '处理中' : '确认开放'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    
      {/* ============================================================== */}
      {/* 抽屉 2: 同窗名录 (Contacts Directory)                           */}
      {/* ============================================================== */}
      <AnimatePresence>
        {isContactsDrawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} onClick={() => setIsContactsDrawerOpen(false)} className="fixed inset-0 bg-[#2C2825]/20 backdrop-blur-[2px] z-40" />
            <motion.div
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 1 }}
              className="fixed left-0 md:left-[60px] top-0 bottom-0 w-full md:w-[480px] bg-[#F3F1ED] shadow-[20px_0_80px_rgba(0,0,0,0.15)] z-50 flex flex-col border-r border-[#8B7355]/20"
            >
              <div className="px-8 py-10 flex justify-between items-center relative z-10">
                <div className="flex flex-col gap-1">
                  <h2 className="font-serif text-2xl text-[#2C2825] tracking-widest">同窗名录</h2>
                  <p className="text-[10px] tracking-[0.3em] uppercase text-[#8B7355] font-serif italic border-b border-[#8B7355]/30 pb-1 w-fit">Address Book</p>
                </div>
                <button onClick={() => setIsContactsDrawerOpen(false)} className="w-10 h-10 flex items-center justify-center text-[#8B7355] hover:text-[#2C2825] transition-colors">
                  <MaterialIcon name="close" className="text-[24px] font-thin" />
                </button>
              </div>
    
              <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-10 flex flex-col gap-6 relative z-10">
                <div className="mt-1 flex items-center justify-between gap-3">
                  <p className="text-[11px] tracking-widest text-[#8B7355] font-serif">
                    名录按“好友本人”聚合；点击后再展开 A 区与所有结缘圈子的 B 区档案。
                  </p>
                  <button
                    type="button"
                    onClick={() => setContactsOnlyFilter((prev) => !prev)}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-serif tracking-[0.2em] transition-colors ${
                      contactsOnlyFilter
                        ? 'border-[#420047] bg-[#420047] text-[#FCFBF8]'
                        : 'border-[#EAE7E1] bg-[#FCFBF8] text-[#8B7355] hover:border-[#8B7355]/40'
                    }`}
                  >
                    {contactsOnlyFilter ? '仅看已解锁' : '筛选有联系方式'}
                  </button>
                </div>

                {loadingAddressBook ? (
                  <div className="p-10 text-center text-[#8B7355]/70 text-sm italic font-serif">正在翻阅你的私密名册...</div>
                ) : addressBookEntries.length === 0 ? (
                  <div className="bg-[#FCFBF8] border border-[#EAE7E1] rounded-lg p-6 flex flex-col items-center justify-center gap-4 text-center mt-4 shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-[#F3F1ED] flex items-center justify-center border border-[#EAE7E1]">
                      <MaterialIcon name="diversity_1" className="text-3xl text-[#8B7355]/50" />
                    </div>
                    <div>
                      <h3 className="font-serif text-[#2C2825] text-sm tracking-widest mb-2">名册尚且空置</h3>
                      <p className="text-[11px] font-serif text-[#8B7355]/80 leading-relaxed tracking-wide">
                        此处为你的私密联系人名册<br/>
                        当联络印记被应允后，名字与暗号都会妥帖收纳于此。<br/>
                        你可随时回来翻阅。
                      </p>
                    </div>
                    <button onClick={() => { setIsContactsDrawerOpen(false); navigate('/circles'); }} className="mt-4 px-5 py-2 rounded-full border border-[#420047] text-[11px] font-serif tracking-widest text-[#420047] hover:bg-[#420047] hover:text-[#FCFBF8] transition-colors">
                      先去大厅逛逛
                    </button>
                  </div>
                ) : filteredAddressBookEntries.length === 0 ? (
                  <div className="bg-[#FCFBF8] border border-[#EAE7E1] rounded-lg p-6 flex flex-col items-center justify-center gap-3 text-center mt-4 shadow-sm">
                    <MaterialIcon name="filter_alt_off" className="text-3xl text-[#8B7355]/50" />
                    <div>
                      <h3 className="font-serif text-[#2C2825] text-sm tracking-widest mb-2">当前筛选下暂无结果</h3>
                      <p className="text-[11px] font-serif text-[#8B7355]/80 leading-relaxed tracking-wide">
                        这些同窗也已经在名录里，只是目前还没有可直接翻阅的联系方式。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setContactsOnlyFilter(false)}
                      className="mt-2 px-5 py-2 rounded-full border border-[#8B7355]/30 text-[11px] font-serif tracking-widest text-[#8B7355] hover:border-[#420047] hover:text-[#420047] transition-colors"
                    >
                      查看全部好友
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-[11px] tracking-widest text-[#8B7355] font-serif mt-2">
                      共收录 {addressBookEntries.length} 位同窗，其中 {addressBookEntries.filter((entry) => entry.hasUnlockedContacts).length} 位已可直接翻阅联系方式。
                    </div>
                    {filteredAddressBookEntries.map((entry) => (
                      <button
                        key={entry.userId}
                        type="button"
                        onClick={() => void handleOpenAddressBookFriend(entry)}
                        className="p-5 bg-[#FCFBF8] border border-[#EAE7E1] shadow-sm rounded-lg flex flex-col gap-4 transition-all hover:shadow-md hover:border-[#8B7355]/35 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 shrink-0 bg-[#EAE7E1] rounded-full flex items-center justify-center text-[#8B7355] font-serif overflow-hidden">
                            {entry.avatarUrl ? <img src={entry.avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : (entry.nickname?.[0] || '?')}
                          </div>
                          <div className="flex-1">
                            <h4 className="text-base font-bold text-[#2C2825]">{entry.nickname || '神秘同窗'}</h4>
                            <p className="text-[10px] text-[#8B7355] mt-0.5">
                              {entry.circleCount > 0
                                ? `已在 ${entry.circleCount} 个圈子结缘 · 自 ${new Date(entry.friendSince).toLocaleDateString()} 起留档`
                                : `已保留全局好友身份 · 自 ${new Date(entry.friendSince).toLocaleDateString()} 起留档`}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {entry.circles.slice(0, 3).map((circle) => (
                            <span key={`${entry.userId}-${circle.circleId}`} className="px-3 py-1 rounded-full bg-[#F3F1ED] text-[10px] tracking-widest text-[#8B7355] font-serif border border-[#EAE7E1]">
                              {circle.circleName}
                            </span>
                          ))}
                          {entry.circles.length > 3 && (
                            <span className="px-3 py-1 rounded-full bg-[#F3F1ED] text-[10px] tracking-widest text-[#8B7355] font-serif border border-[#EAE7E1]">
                              +{entry.circles.length - 3} 个圈子
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-3 border-t border-dashed border-[#EAE7E1] pt-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] tracking-widest font-serif border ${
                              entry.hasUnlockedContacts
                                ? 'border-[#420047]/20 bg-[#420047]/5 text-[#420047]'
                                : entry.contactStatus === 'sent'
                                  ? 'border-[#8B7355]/25 bg-[#8B7355]/5 text-[#8B7355]'
                                  : 'border-[#EAE7E1] bg-[#F7F4EF] text-[#8B7355]/75'
                            }`}>
                              {entry.hasUnlockedContacts
                                ? '已解锁联系方式'
                                : entry.contactStatus === 'sent'
                                  ? '已发送联系方式申请'
                                  : '尚未交换联系方式'}
                            </span>
                          </div>
                          <span className="flex items-center gap-1 text-[11px] font-serif tracking-widest text-[#420047]">
                            翻阅详情
                            <MaterialIcon name="arrow_forward" className="text-[16px]" />
                          </span>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AddressBookFriendDetailModal
        friend={selectedAddressBookFriend}
        loading={loadingAddressBookDetail}
        errorMessage={addressBookDetailError}
        contacts={addressBookDetail?.contacts || []}
        baseModules={addressBookDetail?.baseModules || []}
        circleCards={addressBookDetail?.circleCards || []}
        onClose={closeAddressBookFriendDetail}
        onRequestContact={selectedAddressBookFriend?.contactStatus === 'idle' ? handleRequestAddressBookContact : undefined}
        isRequestingContact={requestingAddressBookContact}
        onRevokeContact={selectedRevocableContactRequestId ? () => void handleRevokeAddressBookContact() : undefined}
        isRevokingContact={Boolean(selectedRevocableContactRequestId && revokingContactRequestId === selectedRevocableContactRequestId)}
        onRemoveFriendEverywhere={selectedAddressBookFriend ? handleRemoveAddressBookFriend : undefined}
        isRemovingFriendEverywhere={removingAddressBookFriend}
        onReport={selectedAddressBookFriend ? () => {
          setReportReasons([]);
          setReportDialogOpen(true);
        } : undefined}
        onToggleBlock={selectedAddressBookFriend ? () => void handleToggleAddressBookBlock() : undefined}
        isBlocking={isBlockingAddressBookFriend}
        isBlocked={isBlockedAddressBookFriend}
        disableSafetyActions={!canSafetyActOnAddressBookFriend}
      />

      <AnimatePresence>
        {reportDialogOpen && (selectedAddressBookFriend || selectedHistory) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2C2825]/40 backdrop-blur-sm px-4"
            onClick={() => setReportDialogOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              className="w-full max-w-xl rounded-xl border border-[#EAE7E1] bg-[#FCFBF8] p-8 shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <h3 className="font-serif text-2xl tracking-widest text-[#2C2825]">举报这位同窗</h3>
              <p className="mt-2 text-[15px] font-serif text-[#8B7355]">你的反馈会由管理员审阅处理。</p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-2 block text-[14px] font-serif tracking-widest text-[#8B7355]">举报原因</label>
                  <div className="space-y-2 rounded-md border border-[#EAE7E1] bg-white px-4 py-3">
                    {REPORT_REASON_OPTIONS.map((item) => (
                      <label key={item.value} className="flex cursor-pointer items-center gap-2 text-[14px] text-[#2C2825]">
                        <input
                          type="checkbox"
                          checked={reportReasons.includes(item.value)}
                          onChange={(e) => {
                            setReportReasons((prev) =>
                              e.target.checked
                                ? prev.includes(item.value) ? prev : [...prev, item.value]
                                : prev.filter((reason) => reason !== item.value)
                            );
                          }}
                          className="h-4 w-4 accent-[#420047]"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-[14px] font-serif tracking-widest text-[#8B7355]">补充说明（可选）</label>
                  <textarea
                    value={reportDetail}
                    onChange={(e) => setReportDetail(e.target.value)}
                    maxLength={500}
                    rows={5}
                    className="w-full rounded-none border border-[#EAE7E1] bg-white px-4 py-3 text-base text-[#2C2825] outline-none focus:border-[#420047]"
                    placeholder="可填写更多细节，便于管理员核实"
                  />
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReportDialogOpen(false)}
                  className="rounded-full border border-[#EAE7E1] px-5 py-2 text-[13px] font-serif tracking-widest text-[#8B7355] transition-colors hover:bg-[#F3F1ED]"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void (selectedAddressBookFriend ? handleSubmitAddressBookReport() : handleSubmitArchiveReport())}
                  disabled={isSubmittingReport || reportReasons.length === 0}
                  className="rounded-full border border-[#420047] bg-[#420047] px-5 py-2 text-[13px] font-serif tracking-widest text-[#FCFBF8] transition-colors hover:bg-[#2A002D] disabled:opacity-50"
                >
                  {isSubmittingReport ? '提交中' : '提交举报'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CardSnapshotModal
        snapshot={activeSnapshot?.snapshot || null}
        title={activeSnapshot?.title}
        subtitle={activeSnapshot?.subtitle}
        onClose={() => setActiveSnapshot(null)}
      />
    
      {/* ============================================================== */}
      {/* 抽屉 3: 历史档案 (Archive)                                     */}
      {/* ============================================================== */}
      <AnimatePresence>
        {isArchiveDrawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} onClick={() => setIsArchiveDrawerOpen(false)} className="fixed inset-0 bg-[#2C2825]/20 backdrop-blur-[2px] z-40" />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 1 }}
              className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-[#F3F1ED] shadow-[-20px_0_80px_rgba(0,0,0,0.15)] z-50 flex flex-col border-l border-[#8B7355]/20"
            >
              {/* 抽屉头部 */}
              <div className="px-10 py-12 flex justify-between items-center relative z-10">
                <div className="flex flex-col gap-2">
                  <h2 className="font-serif text-2xl md:text-3xl text-[#2C2825] tracking-widest">时光落叶</h2>
                  <p className="text-xs tracking-[0.3em] uppercase text-[#8B7355] font-serif italic border-b border-[#8B7355]/30 pb-1 w-fit">Archive</p>
                </div>
                <button
                  type="button"
                  onClick={closeArchiveDrawer}
                  className="w-10 h-10 flex items-center justify-center text-[#8B7355] hover:text-[#2C2825] transition-colors"
                >
                  <MaterialIcon name="close" className="text-[28px] font-thin" />
                </button>
              </div>

                  {/* 历史列表 */}
              <div className="flex-1 overflow-y-auto scrollbar-hide px-8 pb-10 flex flex-col gap-6 relative z-10">
                {history.map((item, i) => (
                  <motion.div
                    key={item.matchId}
                    initial={{ opacity: 0, y: 30, rotate: -1 }}
                    animate={{ opacity: 1, y: 0, rotate: 0 }}
                    transition={{ delay: 0.1 + i * 0.08, type: 'spring', stiffness: 200 }}
                    onClick={() => openHistoryDetail(item)}
                    className="p-8 bg-[#FCFBF8] shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-500 relative group cursor-pointer"
                  >
                    <div className="absolute left-4 top-4 bottom-4 w-[1px] bg-[#8B7355]/10" />
                    <div className="flex justify-between items-start pl-4 relative">
                      <div className="flex flex-col">
                        <div className="font-serif text-2xl md:text-3xl text-[#2C2825] tracking-wide mb-1">
                          {item.partner?.nickname ?? '暂无匹配'}
                        </div>
                        <div className="text-[12px] tracking-[0.2em] text-[#8B7355]/70 font-serif">
                          {formatWeekOf(item.weekOf)}{item.partner ? ` · ${item.partner.department}` : ''}
                        </div>
                        <div className="text-[11px] text-[#8B7355]/50 font-serif mt-1">
                          {!item.partner ? '本周未匹配' : (item.compatibilityScore == null ? '双向奔赴' : `契合度 ${Math.round(item.compatibilityScore * 100)}%`)}
                        </div>
                      </div>
                      <div className={`w-16 h-16 rounded-full border relative flex items-center justify-center transform rotate-[15deg] group-hover:rotate-0 transition-transform duration-500
                        ${item.status === 'MUTUAL' ? 'border-[#8B7355]/40 text-[#8B7355]' : 'border-[#2C2825]/20 text-[#2C2825]/50'}`}>
                        <div className="absolute inset-1 border border-dashed border-inherit rounded-full opacity-50" />
                        <span className="font-serif text-lg">{statusLabel(item.status)}</span>
                      </div>
                    </div>
                    <div className="mt-8 pl-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-[#8B7355]/30 to-transparent" />
                      <span className="text-[11px] text-[#8B7355] font-serif tracking-widest italic">拾起此笺</span>
                    </div>
                  </motion.div>
                ))}
    
                {history.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 opacity-50 pb-20">
                    <MaterialIcon name="history_edu" className="text-5xl font-thin" />
                    <p className="font-serif tracking-widest text-[#8B7355] italic">尚无昔日之缘</p>
                  </div>
                )}
              </div>

              <AnimatePresence>
                {selectedHistory && (
                  <motion.div
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="absolute inset-0 z-20 bg-[#F3F1ED]/96 backdrop-blur-sm px-8 pb-10 pt-8"
                  >
                    <div className="h-full overflow-y-auto overflow-x-visible scrollbar-hide px-2 pb-10 pt-4">
                      <div className="relative overflow-visible rounded-[28px] border border-[#E7DFDB] bg-[#FCFBF8] px-7 pb-7 pt-9 shadow-[0_10px_22px_rgba(44,40,37,0.05),0_2px_6px_rgba(44,40,37,0.04)]">
                        <div className="absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rotate-[-2deg] bg-[#EAE7E1] shadow-[0_2px_6px_rgba(44,40,37,0.08)]">
                          <div className="h-full w-full bg-white/35 skew-x-12" />
                        </div>

                        <div className="mb-6 flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8B7355] font-medium mb-2">
                              {formatWeekOf(selectedHistory.weekOf)} Archive
                            </p>
                            <h3 className="font-serif text-[30px] text-[#2C2825] tracking-wide leading-none">
                              {selectedHistory.partner?.nickname ?? '暂无匹配'}
                            </h3>
                            {selectedHistory.partner && (
                              <p className="mt-3 text-[13px] text-[#8B7355] font-serif tracking-[0.16em]">
                                {selectedHistory.partner.department}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={closeHistoryDetail}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#8B7355] hover:text-[#2C2825] hover:bg-[#F3F1ED] transition-colors"
                          >
                            <MaterialIcon name="close" className="text-[22px]" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-4 rounded-[22px] bg-[#F7F4EF] px-5 py-4 border border-[#E8DED8]">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-[#8B7355] font-medium mb-1">此页札记</p>
                            <p className="text-[14px] text-[#50434e] font-serif">
                              {selectedHistory.status === 'NO_MATCH'
                                ? '本期未能匹配'
                                : selectedHistory.compatibilityScore == null
                                  ? '双向奔赴'
                                  : `契合度 ${Math.round(selectedHistory.compatibilityScore * 100)}%`}
                            </p>
                          </div>
                          <div className={`h-16 w-16 rounded-full border relative flex items-center justify-center rotate-[12deg]
                            ${selectedHistory.status === 'MUTUAL' ? 'border-[#8B7355]/40 text-[#8B7355]' : 'border-[#2C2825]/20 text-[#2C2825]/55'}`}>
                            <div className="absolute inset-1 border border-dashed border-inherit rounded-full opacity-50" />
                            <span className="font-serif text-lg">{statusLabel(selectedHistory.status)}</span>
                          </div>
                        </div>

                        <p className="mt-6 text-[14px] leading-[1.95] text-[#50434e] font-serif">
                          {isHistoryDetailLoading
                            ? '正在展开这页旧笺……'
                            : selectedHistoryResult?.message || historyNote(selectedHistory.status)}
                        </p>

                        {selectedHistory.status === 'MUTUAL' && !isHistoryDetailLoading && (
                          <div className="mt-6 rounded-[24px] border border-[#E8DED8] bg-[#F3F1ED]/70 px-5 py-5">
                            <p className="text-[11px] uppercase tracking-[0.22em] text-[#8B7355] font-medium mb-3">
                              留下的联系方式
                            </p>
                            {selectedHistoryResult?.partnerContact ? (
                              (() => {
                                const contactValue =
                                  selectedHistoryResult.partnerContact.contactId ||
                                  selectedHistoryResult.partnerContact.wechatId ||
                                  '';
                                const platformLabel = getContactPlatformLabel(
                                  selectedHistoryResult.partnerContact.contactPlatform
                                );

                                if (!contactValue) {
                                  return (
                                    <p className="text-[#8B7355]">这页档案没有留下可展示的联系方式。</p>
                                  );
                                }

                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyHistoryContact(contactValue, platformLabel)}
                                    className="group flex w-full items-center justify-between gap-3 rounded-[18px] border border-[#E4DAD2] bg-[#FCFBF8]/88 px-4 py-3 text-left transition-all duration-200 hover:border-[#D7C9BD] hover:bg-[#FCFBF8]"
                                  >
                                    <div className="space-y-1 font-serif text-[#2C2825]">
                                      <p className="text-[14px]">
                                        {platformLabel}：{contactValue}
                                      </p>
                                      <p className="text-[11px] tracking-[0.16em] text-[#8B7355]">
                                        点击复制联系方式
                                      </p>
                                    </div>
                                    <MaterialIcon name="content_copy" className="text-[18px] text-[#8B7355] transition-transform duration-200 group-hover:scale-110" />
                                  </button>
                                );
                              })()
                            ) : (
                              <p className="text-[14px] text-[#8B7355] font-serif">
                                这页档案没有留下可展示的联系方式。
                              </p>
                            )}
                          </div>
                        )}

                        <div className="mt-7 flex items-center justify-between gap-4">
                          <svg width="86" height="8" viewBox="0 0 86 8" fill="none" className="opacity-30">
                            <path d="M2 5.5C20.5 2.3 58 -1.4 84 6" stroke="#8B7355" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                          <div className="flex items-center gap-2">
                            {canSafetyActOnArchivePartner && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReportReasons([]);
                                    setReportDialogOpen(true);
                                  }}
                                  disabled={!canSafetyActOnArchivePartner}
                                  className="rounded-full bg-[#F3F1ED] px-4 py-1.5 text-[12px] font-serif tracking-widest text-[#8B7355] transition-colors hover:bg-[#EEE8DE] disabled:opacity-50"
                                >
                                  举报
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleToggleArchivePartnerBlock()}
                                  disabled={!canSafetyActOnArchivePartner || isBlockingArchivePartner}
                                  className="rounded-full bg-[#F3F1ED] px-4 py-1.5 text-[12px] font-serif tracking-widest text-[#8B7355] transition-colors hover:bg-[#EEE8DE] disabled:opacity-50"
                                >
                                  {isBlockingArchivePartner ? '处理中' : isBlockedArchivePartner ? '取消拉黑' : '拉黑'}
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={closeHistoryDetail}
                              className="text-sm font-serif tracking-widest text-[#8B7355] hover:text-[#2C2825] transition-colors"
                            >
                              合上此笺
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {confirmDialog}
    </div>
  );
};

export default Dashboard;
