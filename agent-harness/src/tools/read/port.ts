export interface ProfileStatus {
  readonly profileComplete: boolean;
  readonly missingFields: readonly string[];
  readonly profile: {
    readonly nickname: string | null;
    readonly gender: string | null;
    readonly genderPreference: string | null;
    readonly intention: string | null;
    readonly grade: string | null;
    readonly campus: string | null;
    readonly department: string | null;
    readonly mbti: string | null;
    readonly bio: string | null;
    readonly signature: string | null;
    readonly tags: readonly string[];
  };
}

export interface QuestionnaireStatus {
  readonly complete: boolean;
  readonly currentVersion: string;
  readonly submittedVersion: string | null;
  readonly needsUpdate: boolean;
  readonly submittedAt: string | null;
}

export interface CircleSearchInput {
  readonly query: string;
  readonly category?: string | undefined;
  readonly tags?: readonly string[] | undefined;
  readonly sort: "recommended" | "active" | "members" | "latest";
  readonly limit: number;
}

export interface CircleSearchItem {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly tags: readonly string[];
  readonly memberCount: number;
  readonly recommendationReasons: readonly string[];
}

export interface CircleSearchResult {
  readonly total: number;
  readonly circles: readonly CircleSearchItem[];
}

export interface ForumSearchInput {
  readonly query: string;
  readonly circleId?: string | undefined;
  readonly type?:
    | "general"
    | "squad"
    | "help"
    | "trade"
    | "activity"
    | undefined;
  readonly sort: "latest" | "hot" | "recommended";
  readonly limit: number;
}

export interface ForumPostSearchItem {
  readonly postId: string;
  readonly circleId: string | null;
  readonly title: string;
  readonly type: string;
  readonly summary: string | null;
  readonly likeCount: number;
  readonly commentCount: number;
  readonly createdAt: string | null;
}

export interface ForumSearchResult {
  readonly total: number;
  readonly posts: readonly ForumPostSearchItem[];
}

export interface ResonanceCapsuleStatusItem {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly role: "creator" | "participant";
  readonly hasResponded: boolean;
  readonly otherHasResponded: boolean;
  readonly expiresAt: string;
}

export interface ResonanceCapsuleStatusResult {
  readonly total: number;
  readonly capsules: readonly ResonanceCapsuleStatusItem[];
}

export interface MeetupSafetyStatusItem {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly meetingAt: string;
  readonly expectedEndAt: string;
}

export interface MeetupSafetyStatusResult {
  readonly total: number;
  readonly plans: readonly MeetupSafetyStatusItem[];
}

export interface NjuMatchReadPort {
  getMyProfileStatus(userId: string): Promise<ProfileStatus>;
  getQuestionnaireStatus(userId: string): Promise<QuestionnaireStatus>;
  searchCircles(
    userId: string,
    input: CircleSearchInput,
  ): Promise<CircleSearchResult>;
  searchForumPosts(
    userId: string,
    input: ForumSearchInput,
  ): Promise<ForumSearchResult>;
  /** Optional for backwards-compatible Harness consumers; production registers both Project B tools. */
  listResonanceCapsules?(userId: string): Promise<ResonanceCapsuleStatusResult>;
  listMeetupSafetyPlans?(userId: string): Promise<MeetupSafetyStatusResult>;
}
