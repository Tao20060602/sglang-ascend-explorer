import { nodes } from "./content.js";

nodes["decode-select"] = {
  id: "decode-select",
  title: "Decode 分支条件",
  code: "forward_decode",
  status: "C",
  role: "根据模型架构、后端配置和执行模式选择具体实现。",
  change: "新增内核前先限定实际支持范围，并找到会进入的条件分支。",
  contract: "不同分支不代表可任意互换；本图展示部分代表性分支。",
  file: "hardware_backend/npu/attention/ascend_backend.py",
  line: 3079,
  children: [],
};
nodes.decode.children.unshift("decode-select");
nodes["comm-select"] = {
  id: "comm-select",
  title: "部署与并行策略",
  code: "TP / EP / PD configuration",
  status: "C",
  role: "按部署选择不同通信场景，三类路径不是串行阶段。",
  change: "先确认单卡、模型并行、MoE expert 并行或 PD 分离的实际需求。",
  contract: "正确分组、rank 参与顺序与数据格式先于通信性能调优。",
  file: "distributed/parallel_state.py",
  line: 103,
  children: [],
};
nodes.comm.children.unshift("comm-select");

// Each field is displayed in the module inspector. These are engineering notes,
// while the pinned source link supplies the evidence for actual implementation.
export const EXPLANATIONS = {
  frontend: {
    inputs: ["文本或 token 请求、生成参数、请求标识。"],
    outputs: ["生成 token / 文本、流式状态和结束原因。"],
    stable: ["API 协议、tokenizer 语义与请求隔离。"],
    checks: ["确认真正的设备瓶颈后再进入内核优化；主机预处理也可能限制供给。"],
  },
  scheduler: {
    inputs: ["等待请求、运行中请求、可用缓存位置与执行结果。"],
    outputs: ["下一轮 Prefill / Decode 批次、token 预算及回收操作。"],
    stable: ["请求生命周期、终止与取消语义。"],
    checks: [
      "按目标输入/输出长度分布测量排队时间、TTFT、TPOT 与吞吐。",
      "KV 容量改变先重算预算；不要直接把容量变化等同于调度算法必须重写。",
    ],
    effects: [
      "更大的 chunk 可能提升计算利用率，也可能增加其他请求等待；需要按服务目标权衡。",
    ],
  },
  executor: {
    inputs: ["调度批次、模型和平台能力、执行模式。"],
    outputs: ["模型执行结果、对应批次的采样或中间状态。"],
    stable: ["批次与结果对应关系、模型执行语义。"],
    checks: [
      "先确认实际走 eager、图执行还是其他分支。",
      "检查 host/device 数据同步、临时内存与不必要等待。",
    ],
    effects: ["局部 kernel 更快，可能被主机提交、布局转换或通信等待抵消。"],
  },
  model: {
    inputs: ["token IDs / embeddings、位置、模型参数与本轮状态。"],
    outputs: ["隐藏状态、logits 及后续采样所需结果。"],
    stable: ["模型层结构、残差数学关系、参数含义与因果语义。"],
    checks: [
      "Qwen2 是示例，不代表全部模型有相同 Attention / MLP 路径。",
      "实现可以改变；head、token 与输出投影列顺序必须正确。",
    ],
  },
  attention: {
    inputs: ["Q/K/V、当前层参数、ForwardBatch 和已准备的元数据。"],
    outputs: [
      "满足公共模型接口的 Attention 结果，以及按接口约定进行的缓存更新。",
    ],
    stable: ["Attention 数学语义、causal/mask/scale 和模型层公共接口。"],
    checks: [
      "确定 MHA / MLA / 稀疏等架构、Prefill / Decode 阶段以及 eager / graph。",
      "列出新内核支持的 dtype、head_dim、head 数、长度和布局。",
      "同 shape 不足以证明 head 顺序、scale 或 mask 一致。",
    ],
    effects: [
      "只换实现且契约相同，KV 与调度通常复用。",
      "输出布局改变时，适配返回值或 out 参数并计入转换成本。",
      "KV 契约改变时，检查缓存读写、分配、页表、图与可选 PD / HiCache。",
    ],
  },
  metadata: {
    inputs: ["当前批次的请求索引、序列长度、请求到 token 的映射和 page_size。"],
    outputs: ["block table、有效序列长度与模式相关信息。"],
    stable: ["请求逻辑位置必须映射到正确的物理缓存。"],
    checks: [
      "核对 CPU 镜像和设备张量的更新时机。",
      "验证长度与页表覆盖范围一致，尤其是跨页、padding 与投机验证模式。",
    ],
  },
  paged: {
    inputs: ["Query、KV 物理缓存、页索引表、有效上下文长度。"],
    outputs: ["当前调用通过 out=attn_output 接收计算结果。"],
    stable: ["读取正确历史 KV、保持 head 顺序与输出投影所需语义。"],
    checks: [
      "这是普通 MHA eager Decode 的一个分支；先核对进入条件。",
      "先单卡基础精度验证，再扩展到其他 dtype、并行或图模式。",
    ],
  },
  "paged-call": {
    inputs: [
      "query、key_cache、value_cache、num_heads、num_kv_heads、scale_value、block_table、context_lens。",
    ],
    outputs: ["写入调用者提供的输出空间 out。"],
    stable: ["在有效长度内进行正确的分页 Attention。"],
    checks: [
      "核对 GQA 比例、head_dim、dtype、mask / scale 以及支持长度。",
      "验证临时 workspace、stream 使用与捕获安全性。",
    ],
    effects: [
      "一个返回新张量的厂商 API，需要在后端接回 attn_output；不应为此改动 HTTP 或调度协议。",
    ],
  },
  output: {
    inputs: ["新算子的返回张量或原先预分配的输出缓冲。"],
    outputs: [
      "该 MHA 分支最终按 [num_tokens, tp_q_head_num * v_head_dim] 返回。",
    ],
    stable: ["每个 token 与 head 的元素顺序以及后续输出投影输入语义。"],
    checks: [
      "THD ↔ HTD 需要检查 transpose/permute；不能只依据元素总数 reshape。",
      "检查 stride、contiguous、dtype 和 device；转换后的数值也要比较。",
    ],
    effects: ["额外 contiguous、dtype 转换或分配可能抵消 kernel 收益。"],
  },
  memory: {
    inputs: ["请求位置、页面约定、模型层数、精度与显存预算。"],
    outputs: ["缓存位置、实际 KV 张量与读写/传输接口。"],
    stable: ["逻辑 token 对应正确的缓存数据，分配回收不破坏其他请求。"],
    checks: [
      "同时检查分配、写入、读取、页表和真实物理存储成本。",
      "覆盖非满页、跨页、混合长度、前缀复用和连续 Decode。",
    ],
    effects: [
      "padding、对齐、scale、workspace 改变后，真实可用 token 容量可能增也可能减。",
      "相关容量变化可能传导到批次预算；传输格式变化则影响已启用的 HiCache / PD。",
    ],
  },
  "kv-pool": {
    inputs: ["分配位置、page_size、dtype、每层 K/V 形状和缓存写入内容。"],
    outputs: ["设备缓存存储与 Attention 可读取的视图。"],
    stable: ["写入的物理地址应与读取路径解释的地址一致。"],
    checks: [
      "MHA、MLA 与其他架构的存储格式要分别分析。",
      "NZ 等内部格式是具体路径的选项，不应概括为所有 NPU KV 都使用同一格式。",
    ],
  },
  graph: {
    inputs: ["固定桶内的输入、缓冲地址、受支持的执行内容和每轮更新值。"],
    outputs: ["可重放的设备执行及对应模型结果。"],
    stable: ["与 eager 路径保持正确的计算语义。"],
    checks: [
      "核对 kernel、workspace、通信与临时内存的捕获安全性。",
      "每轮更新长度与输入；算子、shape 或地址约定改变后检查是否需要重捕获。",
      "图捕获与 torch.compile 是两种不同能力。",
    ],
    effects: [
      "候选收益是降低主机下发开销；额外图缓冲会占用显存。",
      "若可用 KV 容量下降，需要重新评估并发及 token 预算。",
    ],
  },
  ops: {
    inputs: ["模型层输入、权重、量化配置与并行分片信息。"],
    outputs: ["保持模型接口语义的层计算结果。"],
    stable: ["模型层数学关系及公共接口。"],
    checks: [
      "分别定位 GEMM、Norm、激活、RoPE、MoE、Sampling。",
      "权重量化与 KV 量化是不同任务；根据具体内核核对格式与精度。",
    ],
    effects: ["融合可减少中间访存，但可能限制形状或精度；必须测目标负载。"],
  },
  comm: {
    inputs: ["相关 rank 的张量、分片与并行配置；PD 场景还包含缓存传输描述。"],
    outputs: ["集合通信或 dispatch/combine 的结果，以及 PD 传输后的缓存。"],
    stable: ["所有 rank 的参与次序、数据定义与请求结果一致。"],
    checks: [
      "区分 HCCL 集合通信、MoE EP 与 PD KV 传输的职责。",
      "先跑单卡，再按实际部署验证多卡分组和拓扑。",
    ],
    effects: [
      "通信耗时或同步等待可能成为多卡瓶颈；局部算子替换不自动要求改通信算法。",
    ],
  },
  platform: {
    inputs: ["实际设备能力、启动配置与运行时环境。"],
    outputs: ["设备操作、默认值、能力声明及对应子系统实现。"],
    stable: ["引擎通过明确接口使用已验证的平台能力。"],
    checks: [
      "能力声明必须与实际实现一致。",
      "新硬件接入逐项核对设备、算子、Attention/KV、图和通信，不能假设一个插件接口覆盖所有特性。",
    ],
  },
  runtime: {
    inputs: ["设备算子、内存操作、图与通信请求。"],
    outputs: ["真实芯片上的计算、存储与传输结果。"],
    stable: ["对引擎暴露的接口与实际支持能力一致。"],
    checks: [
      "配套驱动、CANN、torch_npu 和专用内核版本。",
      "torch.ops.npu 命名空间不等于每个操作都由 torch_npu 提供，需追到注册来源。",
    ],
  },
};
