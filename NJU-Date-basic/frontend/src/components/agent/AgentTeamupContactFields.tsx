interface Props {
  contactType: string;
  contactValue: string;
  applicationNote: string;
  showApplicationNote: boolean;
  onChange(input: { contactType?: string; contactValue?: string; applicationNote?: string }): void;
}

export default function AgentTeamupContactFields({
  contactType, contactValue, applicationNote, showApplicationNote, onChange,
}: Props) {
  return <div className="agent-sensitive-fields">
    <p>联系方式不会发送给模型，只会在你确认后提交给原组队服务。</p>
    <label>
      联系方式类型
      <select value={contactType} onChange={(event) => onChange({ contactType: event.target.value })}>
        <option value="wechat">微信</option>
        <option value="qq">QQ</option>
        <option value="email">邮箱</option>
        <option value="phone">手机</option>
      </select>
    </label>
    <label>
      联系方式
      <input
        value={contactValue}
        maxLength={120}
        autoComplete="off"
        placeholder="由你本人填写，Agent 不会推断"
        onChange={(event) => onChange({ contactValue: event.target.value })}
      />
    </label>
    {showApplicationNote && <label>
      申请说明
      <textarea
        value={applicationNote}
        maxLength={300}
        rows={3}
        onChange={(event) => onChange({ applicationNote: event.target.value })}
      />
    </label>}
  </div>;
}
