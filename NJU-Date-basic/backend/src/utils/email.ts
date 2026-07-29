import nodemailer from 'nodemailer';
import * as OpenApi from '@alicloud/openapi-client';
import * as _Dm20151123 from '@alicloud/dm20151123';
import { config } from '../config.js';

// CJS/ESM interop: the client constructor is nested at .default.default
const DmClient = (_Dm20151123 as any).default?.default ?? (_Dm20151123 as any).default ?? _Dm20151123;
const DmSingleSendMailRequest = (_Dm20151123 as any).SingleSendMailRequest ?? (_Dm20151123 as any).default?.SingleSendMailRequest ?? DmClient.SingleSendMailRequest;

interface MailPayload {
  to: string;
  subject: string;
  html: string;
}

const DELETED_ACCOUNT_EMAIL_RE = /^deleted_[^@]+@njumatch\.invalid$/i;

export function isDeletedAccountEmail(email?: string | null): boolean {
  return typeof email === 'string' && DELETED_ACCOUNT_EMAIL_RE.test(email.trim());
}

let smtpTransporter: nodemailer.Transporter | null = null;
let aliyunClient: any = null;

function normalizeBaseUrl(base: string): string {
  const trimmed = base.trim();
  if (!trimmed) return 'http://localhost:3001';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/+$/, '');
  }
  return `https://${trimmed}`.replace(/\/+$/, '');
}

function buildAppUrl(pathname: string): string {
  const base = normalizeBaseUrl(config.frontend.publicUrl);
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}`;
}

export function renderCardMail(options: {
  title: string;
  lead: string;
  body: string;
  buttonText?: string;
  buttonUrl?: string;
  footer?: string;
}): string {
  const buttonHtml = options.buttonText && options.buttonUrl
    ? `<div style="margin-top: 20px;">
         <a href="${options.buttonUrl}" style="display:inline-block;padding:12px 22px;background:#420047;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;">
           ${options.buttonText}
         </a>
       </div>`
    : '';

  return `
    <div style="background:#f8f6f3;padding:28px 14px;font-family:'PingFang SC','Microsoft YaHei',sans-serif;color:#2C2825;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #ece6dc;border-radius:14px;overflow:hidden;box-shadow:0 8px 22px rgba(30,22,16,0.05);">
        <div style="padding:24px 24px 6px 24px;background:linear-gradient(180deg,#fcfbf8 0%,#f7f2ea 100%);">
          <div style="letter-spacing:0.18em;color:#8B7355;font-size:12px;text-transform:uppercase;">NJU Match</div>
          <h2 style="margin:10px 0 0 0;font-size:22px;line-height:1.35;color:#2C2825;">${options.title}</h2>
        </div>
        <div style="padding:22px 24px 24px 24px;line-height:1.75;font-size:15px;">
          <p style="margin:0 0 10px 0;color:#5B4D3F;">${options.lead}</p>
          <p style="margin:0;color:#2C2825;white-space:pre-line;">${options.body}</p>
          ${buttonHtml}
          <div style="margin:22px 0 0 0;font-size:12px;color:#8B7355;line-height:1.5;">
            <p style="margin:0;">${options.footer || '本邮件由系统自动发送，请勿直接回复。'}</p>
              <p style="margin:6px 0 0 0;">如果不希望再收到此类通知及宣传活动邮件，可以在 系统设置 内关闭邮件提醒功能。</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;

  if (!config.smtp.host) {
    return null;
  }

  smtpTransporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  return smtpTransporter;
}

function getAliyunClient() {
  if (aliyunClient) return aliyunClient;

  const cfg = config.email.aliyun;
  if (!cfg.accessKeyId || !cfg.accessKeySecret || !cfg.accountName) {
    return null;
  }

  const openApiConfig = new OpenApi.Config({
    accessKeyId: cfg.accessKeyId,
    accessKeySecret: cfg.accessKeySecret,
  });
  openApiConfig.endpoint = 'dm.aliyuncs.com';
  openApiConfig.regionId = cfg.region;

  aliyunClient = new DmClient(openApiConfig);
  return aliyunClient;
}

function logMailPreview(payload: MailPayload) {
  console.log(`\n========================================`);
  console.log(`[MAIL PREVIEW] To: ${payload.to}`);
  console.log(`[MAIL PREVIEW] Subject: ${payload.subject}`);
  console.log(`[MAIL PREVIEW] HTML length: ${payload.html.length}`);
  console.log(`========================================\n`);
}

async function sendViaAliyun(payload: MailPayload) {
  const client = getAliyunClient();
  if (!client) {
    throw new Error('阿里云邮件 API 配置不完整');
  }

  await client.singleSendMail(new DmSingleSendMailRequest({
    accountName: config.email.aliyun.accountName,
    addressType: 1,
    replyToAddress: config.email.aliyun.replyToAddress,
    toAddress: payload.to,
    subject: payload.subject,
    htmlBody: payload.html,
    fromAlias: config.email.aliyun.fromAlias,
  }));
}

async function sendViaSmtp(payload: MailPayload) {
  const transport = getSmtpTransporter();
  if (!transport) {
    if (config.isDev) {
      logMailPreview(payload);
      return;
    }
    throw new Error('SMTP 配置不完整');
  }

  await transport.sendMail({
    from: config.smtp.from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
  });
}

async function sendMail(payload: MailPayload) {
  if (isDeletedAccountEmail(payload.to)) {
    console.warn('[MAIL] Skipped deleted account email address');
    return;
  }

  if (config.email.provider === 'aliyun_api') {
    await sendViaAliyun(payload);
    return;
  }

  await sendViaSmtp(payload);
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  await sendMail({
    to: email,
    subject: 'NJU Match - 验证码',
    html: `
      <div style="font-family:'PingFang SC','Microsoft YaHei',sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; color:#2C2825;">
        <h2 style="color: #420047; margin-top:0;">NJU Match</h2>
        <p>你的验证码是：</p>
        <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #420047; padding: 16px; background: #f5f0f5; border-radius: 8px; text-align: center;">
          ${code}
      </div>
        <p style="color: #8B7355; font-size: 13px; margin-top: 16px;">验证码 5 分钟内有效，请勿告诉他人。</p>
    `,
  });
}


export async function sendPromoEmail(email: string): Promise<void> {
  await sendMail({
    to: email,
    subject: '致NJU Match最初的同路人',
    html: renderCardMail({
      title: '致最初的同路人',
      lead: '专属回馈活动开启',
      body: `见字如面。
截至今日，NJU Match的同行者正式突破1200人。感谢每一位最初的同路人，是你们的真诚与信任，给了这个新生的慢社交平台最珍贵的起点。在此，NJU Match团队向你致以最深的谢意。
 
以下是专属感恩回馈活动说明：
 
1. 活动时间：4月3日（今日）16:00开启，仅开放36小时

2. 参与范围：仅限本次收到邮件的NJU Match前1200位初始注册用户

3. 参与渠道：「校园集市」「南小宝」平台官方推文评论区。今日16:00准时上线；为避免非官方仿冒信息混淆，小红书官方账号「NJU Match」同步发布官方内容，请注意甄别

4. 参与方式：在官方推文中完成点赞+评论，评论需包含「NJUMATCH」中任意连续三个大写字母，比如“在NJ等待U”，欢迎大家发挥想象～

5. 回馈礼设置：3份52.13元现金心意或等值花卉，10份9.99元现金心意或等值花卉

6. 遴选公示：活动结束后全程录屏随机遴选，无法通过评论区联系的获选用户，将在小红书「NJU Match」公示，建议提前关注账号

7. 参与规则：单个账号仅1条有效评论可参与，恶意刷评将取消资格，欢迎友好交流与宝贵建议

再次感谢你的信任与陪伴，未来的路，我们继续同行。

NJU Match 团队
2026年4月3日`,  

      footer: '感谢你的支持，祝你遇见同频的人。',
    }),
  });
}

export async function sendSurveyReminderEmail(email: string, weekOf: string): Promise<void> {
  const surveyUrl = buildAppUrl('/survey');
  await sendMail({
    to: email,
    subject: 'NJU Match 提醒：问卷尚未完成',
    html: renderCardMail({
      title: '问卷还差最后几步',
      lead: `本周匹配周（${weekOf}）即将到来。`,
      body: '你已完成注册，但问卷仍未提交。\n只有完成问卷，系统才能为你安排本周匹配。',
      buttonText: '去完成问卷',
      buttonUrl: surveyUrl,
      footer: '如果你已经提交问卷，可忽略本邮件。',
    }),
  });
}

export async function sendSurveyUpdateNotification(email: string): Promise<void> {
  const surveyUrl = buildAppUrl('/survey');
  await sendMail({
    to: email,
    subject: 'NJU Match：新的匹配引擎与问卷已上线，需要您重新确认',
    html: renderCardMail({
      title: '算法升级与问卷迁移',
      lead: '为了提供更深度的匹配，我们更新了问卷维度。',
      body: '系统检测到你曾经完成了旧版问卷，但为了继续参与本周及未来的匹配，需要你花几分钟在最新版本中补充并重新确认你的匹配偏好。',
      buttonText: '去更新问卷',
      buttonUrl: surveyUrl,
      footer: '如果你暂时想休息，也可以在仪表盘选择「本周暂停」。',
    }),
  });
}

export async function sendHeartboxMutualEmail(
  email: string,
  payload: { heartMatchId: string; reason: 'heartbox'; specialLabel: '双向奔赴' },
): Promise<void> {
  const revealUrl = buildAppUrl('/heartbox/reveal');
  await sendMail({
    to: email,
    subject: 'NJU Match：你收到了一次双向奔赴',
    html: renderCardMail({
      title: '双向奔赴已成立',
      lead: '你与对方在心动信笺中完成了双向选择。',
      body: `信笺编号：${payload.heartMatchId}\n来源：${payload.reason}\n标签：${payload.specialLabel}\n\n你可以前往页面启封查看。系统已为你们自动暂停主线匹配，方便专注当下这段连接。`,
      buttonText: '启封心动信笺',
      buttonUrl: revealUrl,
      footer: '如果之后想继续主线匹配，可以在档案册中重新开启。',
    }),
  });
}

export async function sendOutdatedSurveyReminderEmail(email: string, weekOf: string): Promise<void> {
  const surveyUrl = buildAppUrl('/survey');
  await sendMail({
    to: email,
    subject: 'NJU Match 提醒：问卷版本需要更新',
    html: renderCardMail({
      title: '你的问卷需要重新确认',
      lead: `本周匹配周（${weekOf}）即将到来。`,
      body: '你曾完成过问卷，但当前保存的仍是旧版本。\n只有重新提交最新版问卷，系统才能为你安排本周匹配。',
      buttonText: '去更新问卷',
      buttonUrl: surveyUrl,
      footer: '如果你已经重新提交最新问卷，可忽略本邮件。',
    }),
  });
}

export async function sendMatchExpirationWarning(email: string, weekOf: string): Promise<void> {
  const dashboardUrl = buildAppUrl('/dashboard');
  await sendMail({
    to: email,
    subject: 'NJU Match：本期匹配即将于今晚失效，请做出决定',
    html: renderCardMail({
      title: '选择即将截止',
      lead: `匹配周：${weekOf}，选择期限还剩 8 小时。`,
      body: '你还有一份已揭晓的配对档案未做出“愿见”或“止步”的回应。\n\n本期匹配将于今晚 (周五) 20:00 彻底过期。如果你不做出回应，对方将无法知道你的决定。',
      buttonText: '立刻前往选择',
      buttonUrl: dashboardUrl,
      footer: '注：若到期仍未反馈，系统将自动挂起你近期的匹配以避免资源浪费。',
    }),
  });
}

export async function sendAutoPauseNotification(email: string, weekOf: string): Promise<void> {
  const settingsUrl = buildAppUrl('/settings');
  await sendMail({
    to: email,
    subject: 'NJU Match：由于未能按时回应，已暂停你的匹配',
    html: renderCardMail({
      title: '你错失了上一次回应',
      lead: `我们在 ${weekOf} 为你送出的配对已失效。`,
      body: '因为你在 48 小时内没有点选“愿见”或“止步”，这份际遇已经流入时间之海。\n\n为了避免僵尸席位占用池子资源，我们已暂且把你的账户挂起（暂停匹配）。如果你希望继续参与未来的配对，请随时前往设置将其重新打开。',
      buttonText: '前往设置开启匹配',
      buttonUrl: settingsUrl,
      footer: '如果你觉得暂且休息也不错，可以直接忽略这封邮件。若持续一周未唤醒，席位将被永久休眠。',
    }),
  });
}

export async function sendPermanentSleepNotification(email: string): Promise<void> {
  const settingsUrl = buildAppUrl('/settings');
  await sendMail({
    to: email,
    subject: 'NJU Match：你的席位已永久休眠',
    html: renderCardMail({
      title: '缘分的休止符',
      lead: '你已经连续一周处于系统自动暂停状态并无唤醒动作。',
      body: '为了维护更活跃的匹配环境，我们已经为你切断了匹配池的通路（彻底停止参与）。\n\n但这并非终点，当你再次准备好拥抱随机碰撞的时候，大门随时为你敞开。',
      buttonText: '重回配对池',
      buttonUrl: settingsUrl,
      footer: '在自己的节奏里，走自己的路就好。',
    }),
  });
}

export async function sendMatchRevealedEmail(email: string, weekOf: string): Promise<void> {
  const dashboardUrl = buildAppUrl('/dashboard');
  await sendMail({
    to: email,
    subject: 'NJU Match：本周匹配结果已揭晓',
    html: renderCardMail({
      title: '你的本周匹配已揭晓',
      lead: `匹配周：${weekOf}`,
      body: '你已收到本周匹配结果。\n现在可以查看对方画像，并决定是否愿意见面。',
      buttonText: '查看匹配结果',
      buttonUrl: dashboardUrl,
      footer: '祝你遇见同频的人。',
    }),
  });
}

export async function sendMutualMatchEmail(email: string, weekOf: string): Promise<void> {
  const revealUrl = buildAppUrl('/reveal');
  await sendMail({
    to: email,
    subject: 'NJU Match：你们双方都选择了愿见',
    html: renderCardMail({
      title: '双向红线已牵连',
      lead: `匹配周：${weekOf}`,
      body: '对方也选择了愿意见面。\n你现在可以查看联系方式，开启第一次对话。',
      buttonText: '查看联系方式',
      buttonUrl: revealUrl,
      footer: '祝你们交流顺利。',
    }),
  });
}

export async function sendReportResultEmail(
  email: string,
  options: { reportId: string; status: 'reviewed' | 'dismissed' | 'warn_update'; adminNote?: string },
): Promise<void> {
  const noteSection = options.adminNote ? `\n\n平台说明：${options.adminNote}` : '';
  const content: Record<string, { subject: string; title: string; body: string }> = {
    reviewed: {
      subject: 'NJU Match：你的举报已被受理',
      title: '举报已被受理',
      body: `你提交的举报（编号：${options.reportId}）经管理员审核后已标记为属实。\n\n我们已向相关用户发送提醒，并会结合后续记录继续关注。出于隐私与安全原因，具体处置细节不在邮件中展开。`,
    },
    warn_update: {
      subject: 'NJU Match：感谢你的反馈',
      title: '反馈已处理',
      body: `你提交的举报（编号：${options.reportId}）已处理完毕。\n\n我们已向相关用户发送资料更新提醒，请对方及时核对并更新联系方式等信息。感谢你帮助维护社区信息的准确性。`,
    },
    dismissed: {
      subject: 'NJU Match：你的举报已处理完毕',
      title: '举报已关闭',
      body: `你提交的举报（编号：${options.reportId}）已处理完毕。\n\n目前该举报暂未被采纳，可能是证据不足、无法确认违规，或相关内容暂不构成平台规则处置条件。${noteSection}\n\n感谢你的反馈。`,
    },
  };
  const c = content[options.status];
  await sendMail({
    to: email,
    subject: c.subject,
    html: renderCardMail({
      title: c.title,
      lead: '感谢你帮助维护社区安全。',
      body: c.body,
      footer: '本邮件为平台安全处理通知。如需补充材料，请发送邮件至平台支持邮箱并注明举报编号。',
    }),
  });
}

export async function sendReportWarningEmail(
  email: string,
  options: { reportId: string; reasonText: string; appealEmail: string; adminNote?: string },
): Promise<void> {
  const noteSection = options.adminNote ? `\n\n管理员备注：${options.adminNote}` : '';
  await sendMail({
    to: email,
    subject: 'NJU Match：关于近期社区举报的提醒',
    html: renderCardMail({
      title: '社区行为提醒',
      lead: '我们收到了与你账号相关的举报，并已完成初步审核。',
      body: `举报编号：${options.reportId}\n涉及类型：${options.reasonText || '社区安全相关'}${noteSection}\n\n经管理员审核，该举报已被标记为属实。请你检查并调整资料、发言或互动方式，避免骚扰、虚假资料、不当内容或其他影响社区安全的行为。\n\n如果你认为本次判断存在误会，可以通过 ${options.appealEmail} 提交申诉。申诉时请附上举报编号和你的说明，我们会进一步复核。`,
      footer: '本提醒不会公开展示给其他用户。严重或重复违规可能导致账号功能受限。',
    }),
  });
}

export async function sendReportWarnUpdateEmail(
  email: string,
  options: { reportId: string; adminNote?: string; supportEmail: string },
): Promise<void> {
  const noteSection = options.adminNote ? `\n\n管理员备注：${options.adminNote}` : '';
  await sendMail({
    to: email,
    subject: 'NJU Match：请更新你的资料信息',
    html: renderCardMail({
      title: '资料更新提醒',
      lead: '我们收到了关于你资料信息的反馈，请检查并更新。',
      body: `根据用户反馈，你账号中填写的联系方式（如QQ号、微信号等）或其他资料信息可能存在错误或过期。${noteSection}\n\n请尽快登录 NJU Match，在「个人设置」中核对并更新相关信息，确保配对成功后对方能顺利联系到你。`,
      buttonText: '立即更新资料',
      buttonUrl: 'https://njumatch.com/settings',
      footer: `本提醒不影响你的匹配资格。如有疑问，可通过 ${options.supportEmail} 联系我们。`,
    }),
  });
}

export async function sendReportEvidenceRequestEmail(
  email: string,
  options: { reportId: string; adminNote?: string; supportEmail: string },
): Promise<void> {
  const noteSection = options.adminNote ? `\n\n管理员备注：${options.adminNote}` : '';
  const subject = encodeURIComponent(`举报 ${options.reportId} 补充材料`);
  await sendMail({
    to: email,
    subject: 'NJU Match：请补充举报材料',
    html: renderCardMail({
      title: '举报跟进 — 请补充材料',
      lead: '你提交的举报正在审核中，我们需要更多信息来做出判断。',
      body: `举报编号：${options.reportId}${noteSection}\n\n为帮助我们准确审核，请将相关证明材料（截图、聊天记录等）发送至 ${options.supportEmail}，邮件主题请注明：举报 ${options.reportId} 补充材料。\n\n请在收到此邮件后 72 小时内提交，否则我们将依据现有信息继续处理。`,
      buttonText: '发送证明材料',
      buttonUrl: `mailto:${options.supportEmail}?subject=${subject}`,
      footer: `提交材料时请务必注明举报编号 ${options.reportId}，以便我们快速关联。`,
    }),
  });
}
