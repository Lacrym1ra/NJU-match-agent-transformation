import React from 'react';
import { motion } from 'framer-motion';
import MaterialIcon from './MaterialIcon';

interface UserAgreementProps {
  onAccept: () => void;
  onClose: () => void;
}

const UserAgreement: React.FC<UserAgreementProps> = ({ onAccept, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden relative"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10 bg-gray-100/50 rounded-full p-1"
        >
          <MaterialIcon name="close" className="text-xl block" />
        </button>

        {/* Header */}
        <div className="text-center p-6 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-[#2C2825]">NJU Match 课程衍生版用户协议</h2>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 text-sm text-gray-600 leading-relaxed space-y-5 custom-scrollbar">
          <p>欢迎使用 NJU Match 课程衍生版（以下简称“本平台”）。本平台是独立部署的课程项目，不代表南京大学官方，也不与原项目生产用户库或运营身份互通。请您在开启配对服务之前，认真阅读并充分理解本协议的所有条款。</p>
          
          <h3 className="text-base font-semibold text-[#2C2825] mt-6">一、服务说明</h3>
          <p>NJU Date 是一个基于问卷匹配的校园交友平台。用户通过填写匹配问卷（包括基本信息、价值观、生活方式、情感风格及吸引力偏好等模块），由平台算法定时进行匹配，并将匹配结果推送给用户。</p>
          <p>本平台仅提供信息匹配服务，不构成婚恋介绍服务，不介入用户之间的实际交往行为。</p>
          
          <h3 className="text-base font-semibold text-[#2C2825] mt-6">二、用户资格</h3>
          <h4 className="font-medium text-[#2C2825]">2.1 注册条件</h4>
          <p>您必须同时满足以下条件方可注册和使用本平台：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>(a) 年满18周岁，具备完全民事行为能力；</li>
            <li>(b) 拥有有效的南京大学学生邮箱（@smail.nju.edu.cn）；</li>
            <li>(c) 目前为南京大学在读学生（含本科生、研究生、博士生）或博士后；</li>
            <li>(d) 不存在严重婚恋欺诈、骚扰等不良行为记录。</li>
          </ul>
          
          <h4 className="font-medium text-[#2C2825]">2.2 账号责任</h4>
          <p>每位用户仅可注册一个账号，且不得将账号转让或借予他人使用。您应妥善保管您的账号信息，因账号被盗用或降低安全性而产生的一切后果由您自行承担。</p>
          
          <h3 className="text-base font-semibold text-[#2C2825] mt-6">三、信息收集与隐私保护</h3>
          <h4 className="font-medium text-[#2C2825]">3.1 收集的信息类型</h4>
          <p>为实现匹配服务，本平台将收集您在问卷中填写的以下信息：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>(a) 基本信息：性别、年龄、身高、所在校区、预计毕业年份、家乡等；</li>
            <li>(b) 价值观与生活方式：对待学业/事业的态度、婚育观、消费观、作息习惯、兴趣爱好等；</li>
            <li>(c) 情感风格与偏好：社交风格、亲密关系期待、外貌气质偏好、性格特质等；</li>
            <li>(d) 习惯信息：吸烟、饮酒、饮食要求等个人习惯信息。</li>
          </ul>
          
          <h4 className="font-medium text-[#2C2825]">3.2 信息使用目的</h4>
          <p>您的信息将仅用于以下目的：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>(a) 运行匹配算法，为您匹配合适的对象；</li>
            <li>(b) 向您匹配到的对象展示必要的信息；</li>
            <li>(c) 平台运营统计与算法优化（仅使用匿名化、脱敏后的数据）。</li>
          </ul>
          
          <h4 className="font-medium text-[#2C2825]">3.3 信息保护承诺</h4>
          <p>本平台不以出售个人信息为业务目的。启用真实 Agent Provider 时，完成当前请求所需的最少上下文可能发送给部署者配置的模型服务，具体边界以隐私页面为准。账号注销会清除直接身份字段，并可能为引用完整性保留去标识化的问卷聚合和配对记录；当前测试版尚未配置独立的物理删除工单渠道。</p>
          
          <h4 className="font-medium text-[#2C2825]">3.4 用户权利</h4>
          <p>根据《中华人民共和国个人信息保护法》，您对自己的个人信息依法享有查阅、复制、更正、补充、删除、转移等权利，以及撤回同意的权利。目前，本平台已支持以下功能：(a) 您可以在平台内查看和修改自己填写的问卷信息；(b) 您可以通过平台申请注销账号并删除个人数据。如您需要行使其他个人信息权利（如数据导出、数据转移等），请通过平台内的反馈入口提交申请，运营团队将在收到请求后十五个工作日内予以处理或答复。</p>
          
          <h3 className="text-base font-semibold text-[#2C2825] mt-6">四、匹配服务免责声明</h3>
          <p>请您充分理解并同意以下事项：</p>
          <p>4.1 匹配结果不构成任何承诺。本平台通过算法对用户问卷数据进行分析匹配，匹配结果仅供参考。平台不保证匹配结果的准确性、适配性或满意度，不保证您一定能被匹配到对象，也不保证匹配后能发展为成功的恋爱关系。</p>
          <p>4.2 用户信息的真实性。平台无法对每位用户填写的问卷内容进行实质性审核。其他用户提供的信息（包括但不限于年龄、身高、价值观、生活习惯等）可能存在不准确或不完整的情况。您应当对匹配对象的信息保持合理判断。</p>
          <p>4.3 线下交往风险。平台仅提供线上匹配服务，不参与、不监督、不控制用户之间的线下交往。您与匹配对象之间的所有交流、约会及其他行为均基于您个人的独立判断，相关风险和责任由您自行承担。请务必注意人身安全，建议初次见面选择公共场所。若用户在交流中遭遇言语骚扰、金钱诈骗、违背意愿的线下行为，可通过平台反馈。经核实后，平台将永久封禁违规者，并配合公安机关调取证据。</p>
          <p>4.4 用户行为责任。您以自己的独立判断从事与交友相关的行为，并独立承担可能产生的一切责任。本平台不对用户之间发生的任何纠纷、损失或伤害承担法律责任。</p>
          <p>4.5 服务可用性。本平台将尽力保障服务的稳定运行，但不对服务的不中断、无错误、安全性或及时性作出任何保证。因不可抗力、网络故障、系统维护等原因导致服务中断的，平台不承担赔偿责任。</p>
          
          <h3 className="text-base font-semibold text-[#2C2825] mt-6">五、用户行为规范</h3>
          <p>使用本平台时，您承诺并保证：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>(a) 填写问卷时提供真实、准确的个人信息，不故意弄虚作假；</li>
            <li>(b) 不利用本平台从事任何违法违规活动，包括但不限于欺诈、骚扰、赌博等；</li>
            <li>(c) 不得对其他用户进行人身攻击、侮辱、诽谤、威胁、性骚扰或其他形式的不当行为；</li>
            <li>(d) 不得收集、存储、传播其他用户的个人信息用于本平台服务以外的目的；</li>
            <li>(e) 不得使用自动化工具、脚本或其他技术手段干扰平台正常运行；</li>
            <li>(f) 尊重匹配对象的意愿，当对方明确拒绝时，不得继续打扰。</li>
          </ul>
          <p>违反上述规定的，平台有权立即封禁您的账号，并保留追究法律责任的权利。</p>
          
          <h3 className="text-base font-semibold text-[#2C2825] mt-6">六、知识产权</h3>
          <p>6.1 本平台运营团队对以下原创内容依法享有著作权（依据《中华人民共和国著作权法》，著作权自作品创作完成之日起自动产生，无需登记）：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>(a) 平台的网站前后端源代码及匹配算法的具体代码实现；</li>
            <li>(b) 问卷的题目设计、编排与文案内容；</li>
            <li>(c) 平台的用户界面（UI）设计及原创视觉素材。上述内容虽暂未进行著作权登记，但依法受到保护。未经平台运营团队书面许可，任何人不得复制、修改、传播、反向工程或以其他商业目的使用上述内容。</li>
          </ul>
          <p>6.2 以下内容不属于平台运营团队的知识产权范畴：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>(a) 用户填写的问卷数据及个人信息，其权益归用户本人所有；</li>
            <li>(b) 平台开发过程中使用的第三方开源软件及库，其知识产权归属于各自的原始权利人；</li>
            <li>(c) "NJU"（南京大学）的校名、校徽等标识为南京大学所有，本平台使用相关字样仅用于表明服务对象为南大在校学生，不代表本平台与南京大学存在任何官方隶属、授权或合作关系。</li>
          </ul>
          
          <h3 className="text-base font-semibold text-[#2C2825] mt-6">七、协议的变更与终止</h3>
          <p>7.1 协议变更：本平台有权根据需要对本协议进行修订。修订后的协议将在平台上公布，并通过邮件或站内消息通知您。您继续使用本平台即表示接受修订后的协议。</p>
          <p>7.2 服务终止：本平台保留在任何时候修改、暂停或终止服务的权利。若平台停止运营，将提前通知用户，并在合理期限内删除或匿名化处理所有用户数据。</p>
          <p>7.3 账号注销：您可以通过「账户设置」页面注销账号。注销后直接身份字段会被清除，部分去标识化记录可能为引用完整性保留，账号无法恢复。完整物理删除、备份清除和数据导出尚未形成自助流程，正式接收真实用户前必须由部署者补齐。</p>
          
          <h3 className="text-base font-semibold text-[#2C2825] mt-6">八、适用法律与争议解决</h3>
          <p>本协议适用中华人民共和国法律。因本协议引起的或与本协议有关的任何争议，应首先通过友好协商解决；协商不成的，任何一方均可向平台运营方所在地有管辖权的人民法院提起诉讼。</p>
          
          <h3 className="text-base font-semibold text-[#2C2825] mt-6">九、其他</h3>
          <p>9.1 本平台为校园项目，与南京大学官方无隶属关系。本平台由学生团队独立运营，不代表南京大学的立场或观点。</p>
          <p>9.2 本协议任何条款被认定为无效或不可执行的，不影响其余条款的效力。</p>
          <p>9.3 本协议未尽事宜，按照中华人民共和国相关法律法规处理。</p>
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:p-6 bg-gray-50 flex-shrink-0 z-10 border-t border-gray-200">
          <button 
            onClick={onAccept}
            className="w-full bg-[#611066] hover:bg-[#420047] text-white font-medium py-3.5 rounded-xl transition-all shadow-md hover:shadow-lg active:translate-y-0.5"
          >
            已阅读，同意协议
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default UserAgreement;
