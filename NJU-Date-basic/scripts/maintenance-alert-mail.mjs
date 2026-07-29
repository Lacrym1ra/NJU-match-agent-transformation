import * as OpenApi from '@alicloud/openapi-client';
import * as Dm20151123 from '@alicloud/dm20151123';

const DmClient = Dm20151123.default?.default ?? Dm20151123.default ?? Dm20151123;
const DmSingleSendMailRequest =
  Dm20151123.SingleSendMailRequest ??
  Dm20151123.default?.SingleSendMailRequest ??
  DmClient.SingleSendMailRequest;

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

const toAddress = process.env.MAINTENANCE_ALERT_TO?.trim();
if (!toAddress) {
  console.log('MAINTENANCE_ALERT_TO is empty; skip alert email.');
  process.exit(0);
}

const subject = process.env.MAINTENANCE_ALERT_SUBJECT || '[NJU Match] Maintenance alert';
const textBody = process.env.MAINTENANCE_ALERT_BODY || 'NJU Match maintenance watchdog event.';
const htmlBody = `
  <div style="font-family:'PingFang SC','Microsoft YaHei',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2C2825;">
    <h2 style="margin:0 0 12px;color:#420047;">NJU Match 维护告警</h2>
    <div style="white-space:pre-line;line-height:1.75;font-size:14px;color:#2C2825;">${textBody
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')}</div>
    <p style="margin-top:20px;color:#8B7355;font-size:12px;">本邮件由服务器 watchdog 通过阿里云 DirectMail API 自动发送。</p>
  </div>
`;

const openApiConfig = new OpenApi.Config({
  accessKeyId: required('ALIYUN_DM_ACCESS_KEY_ID'),
  accessKeySecret: required('ALIYUN_DM_ACCESS_KEY_SECRET'),
});
openApiConfig.endpoint = 'dm.aliyuncs.com';
openApiConfig.regionId = process.env.ALIYUN_DM_REGION || 'cn-hangzhou';

const client = new DmClient(openApiConfig);

await client.singleSendMail(new DmSingleSendMailRequest({
  accountName: required('ALIYUN_DM_ACCOUNT_NAME'),
  addressType: 1,
  replyToAddress: process.env.ALIYUN_DM_REPLY_TO_ADDRESS === 'true',
  toAddress,
  subject,
  htmlBody,
  fromAlias: process.env.ALIYUN_DM_FROM_ALIAS || 'NJU Match',
}));

console.log(`Alert email sent to ${toAddress}.`);
