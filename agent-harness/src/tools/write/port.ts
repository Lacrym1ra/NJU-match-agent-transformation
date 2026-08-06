export type ForumPostType = "general" | "squad" | "help" | "trade" | "activity";

export interface PostDraftInput {
  readonly circleId?: string | undefined;
  readonly title: string;
  readonly content: string;
  readonly type: ForumPostType;
  readonly isAnonymous?: boolean | undefined;
}

export interface PostDraft extends PostDraftInput {
  readonly draftId: string;
  readonly createdAt: string;
}

export interface PublishPostResult {
  readonly postId: string;
  readonly url: string;
}

export interface JoinCircleInput {
  readonly circleId: string;
  readonly applicationReason?: string | undefined;
}

export interface JoinCircleResult {
  readonly circleId: string;
  readonly status: "joined" | "pending_review";
}

export interface NjuMatchActionPort {
  createPostDraft(userId: string, input: PostDraftInput): Promise<PostDraft>;
  publishPost(userId: string, draftId: string): Promise<PublishPostResult>;
  joinCircle(userId: string, input: JoinCircleInput): Promise<JoinCircleResult>;
}
