import { nodes as commonNodes, SOURCE_COMMIT } from "./content.js";
import { ROOT_MODULES, RELATIONS } from "./relations.js";

const modelNode = (id, title, code, file, role, options = {}) => ({
  id,
  title,
  code,
  file,
  role,
  status: "C",
  line: options.line || null,
  children: options.children || [],
  change:
    options.change || "保持模型语义，核查所选改动对数据和状态契约的影响。",
  contract: options.contract || role,
  details: options.details || {},
  stateKind: options.stateKind,
  readsHistory: options.readsHistory || false,
});
const cacheNode = (id, title, file, stateKind, role, line) =>
  modelNode(id, title, stateKind, file, role, { stateKind, line });
const edge = (
  from,
  to,
  label,
  payload,
  impact,
  both = false,
  kind = "data",
) => ({ from, to, label, payload, impact, both, kind });
const source = (file, line) =>
  `https://github.com/sgl-project/sglang/blob/${SOURCE_COMMIT}/python/sglang/srt/${file}${line ? "#L" + line : ""}`;

export const KV_CHANGES = {
  capacity: "容量 / 并发预算（布局与数值不变）",
  layout: "物理布局 / 页大小（模型语义不变）",
  precision: "主 KV 精度 / scale（其余状态精度保持）",
  reuse: "前缀复用 / 淘汰与恢复机制",
};

export const MODELS = {
  generic: {
    name: "通用接口（不指定模型）",
    checkpoint: "通用 SRT 接口与普通 MHA 分支示例",
    mechanisms:
      "不代表任意具体模型都走普通分页 MHA；选择模型后按实际结构展开。",
    coverage: "仅展示固定版本的接口与分支，不是硬件兼容认证。",
    nodes: [],
    states: [],
    notes: {},
  },
  deepseek: {
    name: "DeepSeek · V4.1-Flash-1017",
    checkpoint: "deepseek-ai/DeepSeek-V4.1-Flash-1017",
    revision: "1bae0e1088993b9b82de08f59de5be5a34e42170",
    mechanisms:
      "CED / CSA2；共享全局 KV、本层 SWA、Indexer 与压缩状态；DSpark。",
    coverage:
      "存在明确覆盖缺口：此版本 Ascend V4 Attention 只接受比例 0/4/128，目标 V4.1 含 1/2；图示描述需满足的契约，不代表端到端跑通。",
    file: "models/deepseek_v4.py",
    modelChildren: ["ds-ced", "ds-mhc", "ds-engram", "weight-load"],
    attentionChildren: ["ds-attn", "ds-owner", "ds-index", "ds-adapter"],
    attentionRelations: [
      edge(
        "ds-owner",
        "ds-attn",
        "共享 KV 读取",
        "source owner 的全局 KV 供对应逻辑层读取。",
        "改变 owner 布局需核查所有共享 reader。",
      ),
      edge(
        "ds-index",
        "ds-attn",
        "稀疏选择位置",
        "Full / Reindex / Reuse 决定本层使用的选择结果。",
        "选择位置与全局 KV 的寻址单位必须一致。",
      ),
      edge(
        "ds-attn",
        "ds-adapter",
        "昇腾执行约束",
        "核对 ratio、局部窗口、全局缓存与内核支持。",
        "当前固定版本存在 V4.1 ratio 1/2 覆盖缺口。",
        false,
        "config",
      ),
    ],
    states: ["ds-main", "ds-window", "ds-index-state", "ds-compress"],
    specChildren: ["ds-draft", "spec-verify", "spec-commit"],
    nodes: [
      modelNode(
        "ds-ced",
        "CED：Encoder / Decoder",
        "20 + 20 causal layers",
        "models/deepseek_v4.py",
        "Decoder 全局 KV 来自 Encoder 最后表示；长输入路径还需近期 SWA replay。",
        { line: 3835 },
      ),
      modelNode(
        "ds-mhc",
        "Single-Pass mHC",
        "4 residual streams",
        "models/deepseek_v4_mhc.py",
        "组织多残差流和子层混合；融合可能跨层边界，不能只看一个 Norm 函数。",
      ),
      modelNode(
        "ds-engram",
        "Engram 条件记忆",
        "token hash → learned table",
        "layers/engram.py",
        "学习得到的查表参数，经门控注入主干；不是请求的 KV cache。",
      ),
      modelNode(
        "ds-attn",
        "CSA2 与本层 SWA",
        "Q / local + selected global",
        "models/deepseek_v4.py",
        "本层 Q 与局部状态仍需计算；共享 KV 或索引不等于共享 Attention 输出。",
        { line: 2571, readsHistory: true },
      ),
      modelNode(
        "ds-owner",
        "全局 KV 共享所有权",
        "source_layer_of()",
        "mem_cache/deepseek_v4_memory_pool.py",
        "不同逻辑层映射到相同全局 KV 存储；回收和改布局都要找全读取方。",
        { line: 1820 },
      ),
      modelNode(
        "ds-index",
        "Full / Reindex / Reuse",
        "kv_source / index_source",
        "models/deepseek_v4.py",
        "生成全局 KV 与重新选择 Top-K 是独立职责；层 24 重选索引但复用层 20 的 KV。",
        { line: 1445 },
      ),
      modelNode(
        "ds-adapter",
        "昇腾 CSA2 适配边界",
        "ratio 1/2 coverage gap",
        "hardware_backend/npu/attention/ascend_dsv4_backend.py",
        "当前 forward 只接受 0/4/128；放宽检查不等于实现 V4.1 的缓存与索引语义。",
        { line: 2076 },
      ),
      cacheNode(
        "ds-main",
        "共享全局 KV",
        "mem_cache/deepseek_v4_memory_pool.py",
        "history",
        "source owner 生成，全体共享 reader 读取；不能按 40 份独立 main KV 计算容量。",
        1820,
      ),
      cacheNode(
        "ds-window",
        "本层 SWA 窗口缓存",
        "mem_cache/deepseek_v4_memory_pool.py",
        "window",
        "本层局部窗口有独立精度和生命周期；共享 main KV 不代表 SWA 也共享。",
      ),
      cacheNode(
        "ds-index-state",
        "Indexer 键与选择状态",
        "layers/attention/dsv4/dsv41_sparse.py",
        "index",
        "Indexer K、候选池和 Top-K 有各自来源；不是主 KV 量化的自动附带项。",
        203,
      ),
      cacheNode(
        "ds-compress",
        "压缩与近期恢复状态",
        "mem_cache/deepseek_v4_compress_state.py",
        "compress",
        "比例 2 的配对压缩状态和 SWA 恢复必须与请求位置及提交边界一致。",
      ),
      modelNode(
        "ds-draft",
        "DSpark 草稿模块",
        "semi-autoregressive block",
        "models/deepseek_v4_dspark.py",
        "目标配置带 DSpark；特征注入、草稿与验证保留的缓存预算均需核对。",
      ),
    ],
    notes: {
      capacity:
        "同时预算共享 main KV、本层 SWA、压缩/索引状态和 DSpark 预留；共享层不能重复计费。",
      layout:
        "改 owner 写入后，所有共享 reader、层映射和索引到物理位置的转换必须一致；SWA/main 各自核查。",
      precision:
        "本例只改 main KV 表示，保留 SWA 和压缩状态精度；FP4 格式、scale 与反量化须符合实际 NPU 支持。",
      reuse:
        "淘汰或恢复不能只处理一个逻辑层：核对共享 owner 引用、近期 SWA、压缩状态与 DSpark 未提交位置。",
    },
  },
  glm: {
    name: "GLM · 5.3",
    checkpoint: "zai-org/GLM-5.3",
    revision: "ba32f8c19c8738e2c57c71798c601d477a7bf844",
    mechanisms:
      "MLA 潜变量 + DSA；部分层共享 Top-K；目标配置有 1 个 NextN 层。不是 GLM-5.3-Flash。",
    coverage:
      "AscendAttnBackend 中有 MLA / DSA 分支；存在 PD / HiCache 与 compact Index-K 的布局限制。具体芯片、精度和部署组合需实测。",
    file: "models/glm4_moe.py",
    modelChildren: ["glm-core", "weight-load"],
    attentionChildren: ["glm-mla", "glm-index", "glm-sharing", "glm-adapter"],
    attentionRelations: [
      edge(
        "glm-sharing",
        "glm-index",
        "生成或复用选择",
        "indexer_types 决定本层是否重新生成 Top-K。",
        "不能把 Top-K 共享等同于主 KV 存储共享。",
        false,
        "config",
      ),
      edge(
        "glm-index",
        "glm-mla",
        "稀疏 Top-K",
        "选择结果及位置映射约束 MLA 的历史读取。",
        "索引语义和缓存位置必须一致。",
      ),
      edge(
        "glm-mla",
        "glm-adapter",
        "昇腾布局约束",
        "主 MLA、Index-K 与部署路径共同约束缓存格式。",
        "启用 PD / HiCache 时还需核对 host 和传输描述。",
        false,
        "config",
      ),
    ],
    states: ["glm-main", "glm-index-state"],
    specChildren: ["glm-nextn", "spec-verify", "spec-commit"],
    nodes: [
      modelNode(
        "glm-core",
        "GLM-5.3 模型结构",
        "GlmMoeDsaForCausalLM",
        "models/glm4_moe.py",
        "目标 architecture 是 GlmMoeDsaForCausalLM；文件名 glm4 不代表此处在讲旧模型。",
        { line: 1284 },
      ),
      modelNode(
        "glm-mla",
        "MLA 潜变量 Attention",
        "latent KV + RoPE",
        "hardware_backend/npu/attention/ascend_backend.py",
        "按潜变量及位置相关信息组织缓存；不能用普通 MHA 的 head×K/V 形状直接估算。",
        { line: 313, readsHistory: true },
      ),
      modelNode(
        "glm-index",
        "DSA 稀疏选择",
        "Indexer K / Top-K",
        "hardware_backend/npu/attention/ascend_backend.py",
        "稀疏选择与 Attention 读取共同使用位置映射；索引精度变化可能改变选择。",
        { line: 1250 },
      ),
      modelNode(
        "glm-sharing",
        "Top-K 共享条件",
        "indexer_types: full/shared",
        "configs/model_config.py",
        "共享的是 Top-K 选择，不能据此认为主 MLA KV 也像 DeepSeek V4.1 一样跨层共享。",
        { line: 489 },
      ),
      modelNode(
        "glm-adapter",
        "昇腾 DSA 缓存约束",
        "PD / HiCache × compact Index-K",
        "mem_cache/kv_cache_configurator.py",
        "当前 NPU PD/HiCache 条件下不启用 compact Index-K；优化 device pool 时需对齐传输和 host pool。",
        { line: 131 },
      ),
      cacheNode(
        "glm-main",
        "MLA 潜变量缓存",
        "mem_cache/memory_pool.py",
        "history",
        "保存主 Attention 的潜变量历史及位置相关数据；与 Indexer K 分开核对。",
        4736,
      ),
      cacheNode(
        "glm-index-state",
        "DSA 索引键缓存",
        "mem_cache/memory_pool.py",
        "index",
        "实际活跃 Index-K 层、Top-K 复用与紧凑存储有条件；主 KV 未因此自动共享。",
        5261,
      ),
      modelNode(
        "glm-nextn",
        "NextN / MTP 接入",
        "1 nextn layer; index sharing",
        "models/glm4_moe.py",
        "官方配置有 NextN 和 MTP 迭代索引共享选项；算法、图模式与并行组合仍需核查。",
        { line: 1288 },
      ),
    ],
    notes: {
      capacity:
        "分别计算 MLA 主缓存与实际活跃的 Index-K 存储；Top-K 共享不能按主 KV 跨层共享来省预算。",
      layout:
        "同时核查潜变量、Indexer K 和 Top-K 的物理寻址；compact Index-K 会波及 NPU PD 的列表索引和 HiCache host pool。",
      precision:
        "主 MLA 缓存与 Index-K 精度独立；本例不自动改变 Index-K，若另改后者需验证 Top-K 与任务质量。",
      reuse:
        "主缓存、Indexer K 和共享 Top-K 必须指向同一个有效历史边界；取消、抢占、MTP 拒绝后不能复用旧选择。",
    },
  },
  kimi: {
    name: "Kimi · K3",
    checkpoint: "moonshotai/Kimi-K3",
    revision: "f831ab66814297da540d832a5235f8e904f29d06",
    mechanisms:
      "69 KDA + 24 Gated MLA；AttnRes / Stable LatentMoE；历史 KV 与递推/卷积状态两套管理。",
    coverage:
      "注册表有 Ascend KDA / Hybrid 分支，但具体精度与验证路径有约束。该 checkpoint 的 NextN 层数为 0，不将它标成自带 MTP。",
    file: "models/kimi_k3.py",
    modelChildren: ["kimi-core", "kimi-residual", "weight-load"],
    attentionChildren: ["kimi-kda", "kimi-mla", "kimi-hybrid", "kimi-adapter"],
    attentionRelations: [
      edge(
        "kimi-kda",
        "kimi-hybrid",
        "递推状态槽",
        "请求关联 KDA recurrent / conv 状态，执行时读取并更新。",
        "槽位复制、恢复与 verify 回滚不能机械套用 KV 页表。",
        true,
      ),
      edge(
        "kimi-mla",
        "kimi-hybrid",
        "历史 KV 页",
        "同一请求关联 MLA 历史位置，执行时读取并写入。",
        "恢复时与 KDA 状态处于同一个前缀边界。",
        true,
      ),
      edge(
        "kimi-hybrid",
        "kimi-adapter",
        "昇腾状态契约",
        "混合状态与后端 gather / writeback 及 verify scratch 的约束。",
        "检查槽布局、窗口与接受 / 拒绝状态。",
        false,
        "config",
      ),
    ],
    states: ["kimi-main", "kimi-state"],
    specChildren: ["kimi-draft", "spec-verify", "spec-commit"],
    nodes: [
      modelNode(
        "kimi-core",
        "K3 混合层结构",
        "KDA + Gated MLA",
        "models/kimi_k3.py",
        "按配置在不同层选择 KDA 或 MLA；两者历史信息的表示与管理方式不同。",
        { line: 2502 },
      ),
      modelNode(
        "kimi-residual",
        "AttnRes 层间残差",
        "attention residual",
        "layers/attn_residual.py",
        "组织单次 forward 内的层间信息；不是另一套长历史 KV pool。",
      ),
      modelNode(
        "kimi-kda",
        "KDA 递推 Attention",
        "recurrent + conv state",
        "models/kimi_k3.py",
        "以递推与卷积状态承载历史；不能按分页 MLA KV 的逐 token 读写方式直接套用。",
        { line: 1500 },
      ),
      modelNode(
        "kimi-mla",
        "Gated MLA Attention",
        "latent history KV",
        "models/kimi_k3.py",
        "这部分需要历史潜变量缓存和门控；与 KDA 共享请求身份，不共享相同存储语义。",
        { line: 2148, readsHistory: true },
      ),
      modelNode(
        "kimi-hybrid",
        "混合状态与请求映射",
        "HybridReq / HybridLinearKVPool",
        "mem_cache/memory_pool.py",
        "同一请求同时关联历史 KV 页和 KDA state 槽；前缀恢复必须对齐同一个位置。",
        { line: 4210 },
      ),
      modelNode(
        "kimi-adapter",
        "昇腾 KDA 状态接口",
        "gather → compute → writeback",
        "hardware_backend/npu/attention/ascend_kda_backend.py",
        "状态槽、conv 窗口与 verify scratch 有明确约束；接受/拒绝后状态回退不能省略。",
        { line: 98 },
      ),
      cacheNode(
        "kimi-main",
        "Gated MLA 潜变量缓存",
        "hardware_backend/npu/memory_pool_npu.py",
        "history",
        "保存 MLA 层的历史 KV；页大小与量化针对这条路径分析。",
        629,
      ),
      cacheNode(
        "kimi-state",
        "KDA 递推与卷积状态",
        "hardware_backend/npu/attention/ascend_kda_backend.py",
        "recurrent",
        "这是递推累加/卷积状态，不是分页 KV。仅改 MLA KV 精度时保留它的精度；恢复与回滚另行处理。",
        98,
      ),
      modelNode(
        "kimi-draft",
        "推测解码接入条件",
        "checkpoint nextn = 0",
        "configs/kimi_k3.py",
        "本 checkpoint 不带 NextN；如另接草稿，需验证混合状态的提交与回滚，不能暗示当前已启用 MTP。",
      ),
    ],
    notes: {
      capacity:
        "MLA 的历史 token 容量和 KDA 的并发请求/state 槽容量是不同维度；增加前者不自动增加后者。",
      layout:
        "本例修改 MLA 页/布局；KDA 递推公式通常保留，但混合请求映射、state 槽复制与前缀恢复需要核查。",
      precision:
        "本例只修改 MLA KV 精度，保留 KDA 累加与卷积状态精度；递推状态量化是另一项数值优化，误差会随递推传播。",
      reuse:
        "恢复前缀时同时恢复对应位置的 MLA 历史页与 KDA recurrent/conv 状态；只恢复页表仍可能读到错误历史。",
    },
  },
};

export function modelContext(id) {
  const profile = MODELS[id];
  const nodes = { ...commonNodes };
  if (id !== "generic") {
    for (const n of profile.nodes) {
      nodes[n.id] = n.stateKind
        ? {
            ...n,
            details: {
              inputs: [
                "本请求的有效位置、模型层/owner 映射与该类状态；不能混用另一种状态的地址单位。",
              ],
              outputs: [
                "可供后续执行访问的有效历史或递推状态，以及一致的提交边界。",
              ],
              stable: [
                "保持 checkpoint 的状态更新语义与请求隔离；存储形式和生命周期策略可以按场景优化。",
              ],
              checks: [profile.notes.layout, profile.notes.reuse],
              effects: [profile.notes.capacity, profile.notes.precision],
            },
          }
        : n;
    }
    const replace = (key, patch) => {
      nodes[key] = { ...nodes[key], ...patch };
    };
    replace("model", {
      details: {},
      role: profile.mechanisms,
      contract:
        "保持当前 checkpoint 的层类型、因果关系、参数语义和状态更新规则。",
      code: profile.name,
      file: profile.file,
      line: null,
      children: profile.modelChildren,
    });
    replace("attention", {
      code: profile.mechanisms.split("；")[0],
      file: profile.file,
      line: null,
      children: profile.attentionChildren,
      role: profile.mechanisms,
      details: {},
      contract:
        "执行本模型的 Attention 和状态更新；不能将普通 MHA 路径当成所有模型的实现。",
    });
    replace("memory", {
      role: "组织本模型的请求映射、缓存/状态分配与生命周期。",
      details: {},
      code: "模型状态 · Pool · 生命周期",
      children: ["mapping", "allocator", "kv-pool", "hicache"],
    });
    replace("kv-pool", {
      role: profile.notes.capacity,
      contract:
        "每类状态的读写格式、所有权与有效历史边界一致；不同状态使用各自访问语义。",
      details: {},
      title: "模型缓存与状态池",
      code: profile.name,
      file: profile.nodes.find((n) => n.stateKind).file,
      line: null,
      children: [...profile.states, "kv-size", "kv-write", "kv-read"],
    });
    replace("kv-write", {
      title: "模型状态更新接口",
      code: "model-specific write / update",
      details: {},
      contract:
        "历史位置、状态所有权、精度与提交边界一致；辅助状态使用各自更新路径。",
      file: nodes[profile.states[0]].file,
      line: nodes[profile.states[0]].line,
      role: "把本轮有效状态写入对应模型的缓存；具体布局和共享规则见同层状态模块。",
    });
    replace("kv-read", {
      title: "模型状态访问接口",
      code: "history / auxiliary / recurrent",
      details: {},
      contract:
        "各状态保留实际访问语义；本节点汇总契约，不暗示共用一个 get_value_buffer 函数。",
      file: nodes[profile.states[0]].file,
      line: nodes[profile.states[0]].line,
      role: "按本模型的状态所有权与位置映射读取；递推状态不能直接套用分页 KV 读取。",
    });
    nodes.speculation = modelNode(
      "speculation",
      "推测解码与状态提交",
      profile.name,
      profile.file,
      "草稿、目标验证与缓存提交；仅在具备对应配置和实现时启用。",
      { children: profile.specChildren },
    );
    nodes["spec-verify"] = modelNode(
      "spec-verify",
      "目标验证与有效位置",
      "target verify",
      "speculative/spec_info.py",
      "验证多个草稿位置时检查 mask、长度、临时缓存和图容量，不等同普通单 token Decode。",
    );
    nodes["spec-commit"] = modelNode(
      "spec-commit",
      "接受 / 拒绝与状态恢复",
      "commit / rollback",
      "speculative/spec_utils.py",
      "保留接受位置，回收或恢复拒绝部分；主缓存、辅助索引或递推状态要同步。",
    );
  }
  const roots =
    id === "generic"
      ? ROOT_MODULES
      : [...ROOT_MODULES.slice(0, 4), "speculation", ...ROOT_MODULES.slice(4)];
  const active = new Set(),
    parent = {};
  const walk = (key) => {
    if (active.has(key)) return;
    active.add(key);
    for (const child of nodes[key].children) {
      parent[child] = key;
      walk(child);
    }
  };
  roots.forEach(walk);
  const relations = (scope) => {
    const children = scope === "root" ? roots : nodes[scope].children;
    let list = RELATIONS[scope] || [];
    if (id !== "generic") {
      if (scope === "root")
        list = [
          ...list.map((e) => {
            if (e.from === "model" && e.to === "attention")
              return {
                ...e,
                label: "模型 Attention / 状态",
                payload: profile.mechanisms,
                impact: "模型决定算子与状态语义；后端必须实现对应分支。",
              };
            if (e.from === "attention" && e.to === "memory")
              return {
                ...e,
                label: "历史 / 辅助状态访问",
                payload:
                  "正向：按请求位置读取或更新模型状态；反向：返回对应存储视图、状态槽或历史数据。" +
                  profile.notes.reuse,
                impact: profile.notes.layout,
              };
            return e;
          }),
          edge(
            "model",
            "memory",
            "模型状态契约",
            profile.mechanisms,
            profile.notes.layout,
            false,
            "config",
          ),
          edge(
            "scheduler",
            "speculation",
            "验证预算",
            "启用推测解码时分配验证 token 与临时状态预算。",
            "草稿更长可能增加缓存与验证开销。",
            false,
            "config",
          ),
          edge(
            "speculation",
            "executor",
            "草稿 / 验证执行",
            "条件启用的生成路径，执行草稿和目标验证。",
            "检查新模式与图执行支持。",
          ),
          edge(
            "speculation",
            "memory",
            "临时状态 / 提交",
            "正向：申请未提交位置，接受后提交，拒绝后回收或恢复；反向：返回状态位置与可用容量。",
            profile.notes.reuse,
            true,
          ),
        ];
      if (scope === "model")
        list = [
          edge(
            profile.modelChildren[0],
            "weight-load",
            "结构 / 参数契约",
            "模型结构决定参数的解释和加载。",
            "文件名和共享类名不等于模型版本。",
            false,
            "config",
          ),
        ];
      if (scope === "attention") list = profile.attentionRelations;
      if (scope === "kv-pool")
        list = [
          edge(
            "kv-size",
            profile.states[0],
            "实际存储预算",
            profile.notes.capacity,
            "容量估算需包含辅助状态、对齐与临时存储。",
            false,
            "config",
          ),
          ...profile.states.map((key) =>
            edge(
              key,
              "kv-read",
              "状态访问契约",
              nodes[key].role,
              profile.notes.layout,
            ),
          ),
          edge(
            "kv-write",
            profile.states[0],
            "写入主历史状态",
            "按缓存格式与位置写入主历史；辅助状态另有模型专用更新。",
            profile.notes.reuse,
          ),
        ];
      if (scope === "speculation")
        list = [
          edge(
            profile.specChildren[0],
            "spec-verify",
            "草稿 / 验证输入",
            "仅在草稿模型和后端支持条件成立时提供多个位置。",
            "不能以配置字段存在证明整个推测路径已支持。",
          ),
          edge(
            "spec-verify",
            "spec-commit",
            "有效前缀",
            "验证结果决定接受位置和需要恢复的状态。",
            profile.notes.reuse,
          ),
        ];
    }
    return list
      .filter((e) => children.includes(e.from) && children.includes(e.to))
      .map((e, index) => ({
        ...e,
        id: `${scope}-${index + 1}`,
        number: String(index + 1).padStart(2, "0"),
      }));
  };
  return { profile, nodes, roots, active, parent, relations };
}

export function modelScenario(state, base, context) {
  if (state.scenario !== "kv") {
    if (context.profile.states.length && base.map) {
      const changesStorage =
        state.scenario === "attention" && state.variant === "layout";
      const map = { ...base.map },
        notes = { ...base.notes };
      for (const key of context.profile.states) {
        const kind = context.nodes[key].stateKind;
        map[key] =
          changesStorage && kind !== "recurrent" && kind !== "compress"
            ? "A"
            : state.scenario === "quant"
              ? "S"
              : "C";
        notes[key] = changesStorage
          ? context.profile.notes.layout
          : state.scenario === "quant"
            ? "权重量化不自动改变该模型状态的精度与格式。"
            : "核对该模型状态与所选执行路径的接口。";
      }
      for (const key of context.profile.attentionChildren) {
        map[key] =
          state.scenario === "quant"
            ? "S"
            : changesStorage && context.nodes[key].readsHistory
              ? "A"
              : "C";
      }
      return { ...base, map, notes };
    }
    return base;
  }
  const intent = state.kvChange,
    profile = context.profile,
    map = {},
    notes = {};
  const set = (ids, s, text) =>
    ids.forEach((key) => {
      map[key] = s;
      notes[key] = text;
    });
  const modelNote =
    profile.notes[intent] ||
    "通用接口示例；选择模型后核对实际缓存种类与生命周期。";
  const contracts = {
    capacity: {
      direct: ["memory", "kv-size", "batch"],
      review: [
        "allocator",
        "mapping",
        "scheduler",
        "prefill-sched",
        "kv-pool",
        "graph",
        "graph-buffers",
        "speculation",
      ],
      action:
        "调整真实存储与 token / 并发预算；不改布局与计算数值，通常不要求重写 Attention kernel。",
      effect:
        "更多可用容量可能减少拒绝或容纳更多请求，也可能增加排队与单轮耗时；吞吐不保证单调提升。",
    },
    layout: {
      direct: [
        "memory",
        "allocator",
        "kv-pool",
        "kv-write",
        "kv-read",
        "attention",
        "metadata",
        "block-table",
        "kv-input",
      ],
      review: [
        "mapping",
        "kv-size",
        "scheduler",
        "batch",
        "graph",
        "graph-buffers",
        "graph-update",
        "hicache",
        "pd",
        "comm",
        "speculation",
      ],
      action:
        "同步修改物理布局、读写和寻址契约；页大小变化时核查分配与索引单位。",
      effect:
        "对齐、碎片、转换与传输成本可能变化；图地址和容量需重新验证，必要时重建池并重捕获。",
    },
    precision: {
      direct: [
        "memory",
        "kv-pool",
        "kv-write",
        "kv-read",
        "attention",
        "attn-kernel",
      ],
      review: [
        "kv-size",
        "metadata",
        "scheduler",
        "batch",
        "graph",
        "graph-buffers",
        "hicache",
        "pd",
        "comm",
        "speculation",
      ],
      action:
        "本例仅改变主历史 KV 的数值表示；对齐 scale、量化写入和读取 / 反量化，保留其余状态精度。",
      effect:
        "存储减少还需扣除 scale、填充与 workspace；数值误差和反量化成本可能影响质量与端到端收益。",
    },
    reuse: {
      direct: ["prefix", "allocator", "mapping", "memory"],
      review: [
        "kv-pool",
        "kv-write",
        "kv-read",
        "attention",
        "scheduler",
        "batch",
        "hicache",
        "pd",
        "graph",
        "speculation",
        "spec-commit",
      ],
      action:
        "修改前缀匹配、共享引用、淘汰与恢复生命周期；保持同一请求历史边界的全部状态一致。",
      effect:
        "命中率和恢复成本会改变；错误回收、过期索引或不完整的递推状态恢复会产生错误结果。",
    },
  };
  const rule = contracts[intent];
  set(rule.direct, "A", rule.action);
  set(rule.review, "C", rule.effect);
  const stateDirect = {
    capacity: [],
    layout: ["history", "window", "index"],
    precision: ["history"],
    reuse: ["history", "window", "index", "recurrent", "compress"],
  }[intent];
  for (const key of profile.states) {
    const kind = context.nodes[key].stateKind;
    const stable =
      intent === "precision" &&
      ["recurrent", "window", "compress"].includes(kind);
    set(
      [key],
      stable ? "S" : stateDirect.includes(kind) ? "A" : "C",
      stable
        ? "本例保留此状态的精度与语义；不得把主 KV 量化自动扩展到递推累加或局部状态。"
        : modelNote,
    );
  }
  for (const key of profile.attentionChildren || []) {
    const changesReader =
      ["layout", "precision"].includes(intent) &&
      context.nodes[key].readsHistory;
    set(
      [key],
      intent === "capacity" ? "S" : changesReader ? "A" : "C",
      modelNote,
    );
  }
  const step = (title, detail, active) => ({ title, detail, active });
  return {
    title: `${profile.name} · ${KV_CHANGES[intent]}`,
    map,
    notes,
    effects: [
      { node: "memory", title: "模型状态与所有权", text: modelNote },
      { node: "attention", title: "计算与状态接口", text: rule.action },
      {
        node: "graph",
        title: "图执行与可选传输",
        text: "仅在启用时核对静态缓冲、HiCache、PD 两端描述；需要核对不等于必须重写通信算法。",
      },
      { node: "scheduler", title: "服务端结果", text: rule.effect },
    ],
    steps: [
      step("确定状态与所有者", modelNote, [
        "model",
        "memory",
        ...profile.states,
      ]),
      step("修改目标契约", rule.action, [
        ...rule.direct,
        ...profile.states.filter((key) =>
          stateDirect.includes(context.nodes[key].stateKind),
        ),
      ]),
      step(
        "检查上下游",
        "沿图中接口核查读取者、索引、请求映射、图执行与条件启用的传输 / 推测路径。",
        rule.review,
      ),
      step("重算成本与预算", rule.effect, [
        "kv-size",
        "batch",
        "scheduler",
        "executor",
      ]),
      step(
        "验证边界与质量",
        "覆盖跨页、不同长度、取消 / 抢占 / 恢复、多请求隔离；如启用推测解码，检查部分接受和拒绝状态；精度变化另做质量验证。",
        ["memory", "attention", "speculation", "executor"],
      ),
    ],
  };
}

export function modelSources(profile) {
  if (!profile.revision) return [];
  const adapter = profile.nodes.find(
    (n) => n.id === profile.attentionChildren.at(-1),
  );
  return [
    {
      title: "官方 checkpoint 配置",
      url: `https://huggingface.co/${profile.checkpoint}/blob/${profile.revision}/config.json`,
    },
    { title: "固定版本模型实现", url: source(profile.file) },
    { title: "昇腾接入 / 约束依据", url: source(adapter.file, adapter.line) },
  ];
}
