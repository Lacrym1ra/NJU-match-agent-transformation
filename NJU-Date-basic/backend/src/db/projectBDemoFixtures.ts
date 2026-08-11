export type DemoUserEmail = 'alice@smail.nju.edu.cn' | 'bob@smail.nju.edu.cn';
export type CapsuleStatus = 'awaiting_participant' | 'collecting' | 'revealed' | 'cancelled';
export type MeetupStoredStatus = 'scheduled' | 'checked_in' | 'completed' | 'cancelled';
export type MeetupScenario = MeetupStoredStatus | 'overdue';

export const PROJECT_B_DEMO_RECORD_IDS = [
  'b0000000-0000-4000-8000-000000000001',
  'b0000000-0000-4000-8000-000000000002',
  'b0000000-0000-4000-8000-000000000003',
  'b0000000-0000-4000-8000-000000000004',
  'b0000000-0000-4000-8000-000000000101',
  'b0000000-0000-4000-8000-000000000102',
  'b0000000-0000-4000-8000-000000000103',
  'b0000000-0000-4000-8000-000000000104',
  'b0000000-0000-4000-8000-000000000105',
] as const;

export interface ProjectBDemoCapsule {
  id: string;
  creatorEmail: DemoUserEmail;
  participantEmail: DemoUserEmail | null;
  inviteCode: string;
  title: string;
  prompt: string;
  creatorResponse: string | null;
  participantResponse: string | null;
  status: CapsuleStatus;
  expiresAt: string;
  revealedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBDemoMeetup {
  id: string;
  userEmail: DemoUserEmail;
  title: string;
  meetingPlace: string;
  meetingAt: string;
  expectedEndAt: string;
  note: string;
  scenario: MeetupScenario;
  storedStatus: MeetupStoredStatus;
  checkedInAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function offset(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60_000).toISOString();
}

export function buildProjectBDemoFixtures(now = new Date()): {
  capsules: ProjectBDemoCapsule[];
  meetups: ProjectBDemoMeetup[];
} {
  const createdRecently = offset(now, -180);

  return {
    capsules: [
      {
        id: PROJECT_B_DEMO_RECORD_IDS[0],
        creatorEmail: 'alice@smail.nju.edu.cn',
        participantEmail: null,
        inviteCode: 'RSN2A7BC',
        title: '第一次线下见面前的小问题',
        prompt: '最近哪一件小事最能代表你现在的生活状态？',
        creatorResponse: null,
        participantResponse: null,
        status: 'awaiting_participant',
        expiresAt: offset(now, 7 * 24 * 60),
        revealedAt: null,
        createdAt: createdRecently,
        updatedAt: createdRecently,
      },
      {
        id: PROJECT_B_DEMO_RECORD_IDS[1],
        creatorEmail: 'alice@smail.nju.edu.cn',
        participantEmail: 'bob@smail.nju.edu.cn',
        inviteCode: 'RSN3D8EF',
        title: '学习搭子默契测试',
        prompt: '你理想中的一次共同学习应该怎样安排？',
        creatorResponse: '先各自专注四十五分钟，再休息十分钟交换进度。',
        participantResponse: null,
        status: 'collecting',
        expiresAt: offset(now, 5 * 24 * 60),
        revealedAt: null,
        createdAt: offset(now, -24 * 60),
        updatedAt: offset(now, -60),
      },
      {
        id: PROJECT_B_DEMO_RECORD_IDS[2],
        creatorEmail: 'bob@smail.nju.edu.cn',
        participantEmail: 'alice@smail.nju.edu.cn',
        inviteCode: 'RSN4G9HK',
        title: '周末能量补给方式',
        prompt: '忙完一周后，你最想用什么方式恢复能量？',
        creatorResponse: '打完一场球，再和朋友慢慢吃顿饭。',
        participantResponse: '带相机散步，看完日落后找一家安静的小店。',
        status: 'revealed',
        expiresAt: offset(now, 3 * 24 * 60),
        revealedAt: offset(now, -120),
        createdAt: offset(now, -2 * 24 * 60),
        updatedAt: offset(now, -120),
      },
      {
        id: PROJECT_B_DEMO_RECORD_IDS[3],
        creatorEmail: 'alice@smail.nju.edu.cn',
        participantEmail: null,
        inviteCode: 'RSN5J2LM',
        title: '已取消的活动偏好',
        prompt: '如果临时空出半天，你更想去哪里？',
        creatorResponse: null,
        participantResponse: null,
        status: 'cancelled',
        expiresAt: offset(now, 24 * 60),
        revealedAt: null,
        createdAt: offset(now, -3 * 24 * 60),
        updatedAt: offset(now, -2 * 24 * 60),
      },
    ],
    meetups: [
      {
        id: PROJECT_B_DEMO_RECORD_IDS[4],
        userEmail: 'alice@smail.nju.edu.cn',
        title: '仙林校区咖啡交流',
        meetingPlace: '仙林校区图书馆一楼公共休息区',
        meetingAt: offset(now, 24 * 60),
        expectedEndAt: offset(now, 26 * 60),
        note: '首次见面选择人流较多的公共区域，计划变化时主动更新。',
        scenario: 'scheduled',
        storedStatus: 'scheduled',
        checkedInAt: null,
        completedAt: null,
        cancelledAt: null,
        createdAt: createdRecently,
        updatedAt: createdRecently,
      },
      {
        id: PROJECT_B_DEMO_RECORD_IDS[5],
        userEmail: 'alice@smail.nju.edu.cn',
        title: '鼓楼校区羽毛球活动',
        meetingPlace: '鼓楼校区体育馆前台',
        meetingAt: offset(now, -30),
        expectedEndAt: offset(now, 90),
        note: '已经到达，结束后手动标记完成。',
        scenario: 'checked_in',
        storedStatus: 'checked_in',
        checkedInAt: offset(now, -25),
        completedAt: null,
        cancelledAt: null,
        createdAt: offset(now, -24 * 60),
        updatedAt: offset(now, -25),
      },
      {
        id: PROJECT_B_DEMO_RECORD_IDS[6],
        userEmail: 'bob@smail.nju.edu.cn',
        title: '结对编程复盘',
        meetingPlace: '软件学院公共讨论区',
        meetingAt: offset(now, -2 * 24 * 60),
        expectedEndAt: offset(now, -2 * 24 * 60 + 120),
        note: '已完成的历史样例。',
        scenario: 'completed',
        storedStatus: 'completed',
        checkedInAt: offset(now, -2 * 24 * 60 + 5),
        completedAt: offset(now, -2 * 24 * 60 + 100),
        cancelledAt: null,
        createdAt: offset(now, -3 * 24 * 60),
        updatedAt: offset(now, -2 * 24 * 60 + 100),
      },
      {
        id: PROJECT_B_DEMO_RECORD_IDS[7],
        userEmail: 'alice@smail.nju.edu.cn',
        title: '逾期状态演示',
        meetingPlace: '仙林校区大学生活动中心大厅',
        meetingAt: offset(now, -5 * 60),
        expectedEndAt: offset(now, -2 * 60),
        note: '数据库保持 scheduled，由服务层根据结束时间派生 overdue。',
        scenario: 'overdue',
        storedStatus: 'scheduled',
        checkedInAt: null,
        completedAt: null,
        cancelledAt: null,
        createdAt: offset(now, -24 * 60),
        updatedAt: offset(now, -5 * 60),
      },
      {
        id: PROJECT_B_DEMO_RECORD_IDS[8],
        userEmail: 'bob@smail.nju.edu.cn',
        title: '已取消的校园漫步',
        meetingPlace: '鼓楼校区北园门口',
        meetingAt: offset(now, 3 * 24 * 60),
        expectedEndAt: offset(now, 3 * 24 * 60 + 90),
        note: '用于验证取消状态不会再接受签到。',
        scenario: 'cancelled',
        storedStatus: 'cancelled',
        checkedInAt: null,
        completedAt: null,
        cancelledAt: offset(now, -60),
        createdAt: offset(now, -2 * 24 * 60),
        updatedAt: offset(now, -60),
      },
    ],
  };
}
