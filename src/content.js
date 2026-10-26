export const SOURCE_COMMIT = "66cac6b79ccffa13c108297fad8a43ddc49d06f8";
export const KERNEL_COMMIT = "6fba476a4c4387fdbb4aec09f0619415b9495f0d";
export const nodes = {};
const N = (
  id,
  title,
  code,
  status,
  role,
  change,
  contract,
  file,
  line,
  children = [],
) => {
  nodes[id] = {
    id,
    title,
    code,
    status,
    role,
    change,
    contract,
    file,
    line,
    children,
  };
  return id;
};
N(
  "api",
  "HTTP / OpenAI API",
  "entrypoints",
  "S",
  "接收请求，提供生成与流式返回接口。",
  "通常保留协议；不在 HTTP handler 内植入设备算子。",
  "请求 schema、返回格式与错误语义保持。",
  "entrypoints/http_server.py",
);
N(
  "tokenizer",
  "Tokenize / 请求状态",
  "TokenizerManager",
  "S",
  "将文本请求转为 token，并管理请求状态。",
  "文本与模型 tokenizer 不变时通常复用。",
  "token IDs、采样参数与请求标识保持。",
  "managers/tokenizer_manager.py",
  459,
);
N(
  "detokenizer",
  "Detokenize / 流式输出",
  "DetokenizerManager",
  "S",
  "将生成的 token 整理为输出。",
  "通常复用；观察主机处理是否造成瓶颈。",
  "token 顺序、结束条件和流式协议保持。",
  "managers/detokenizer_manager.py",
);
N(
  "frontend",
  "请求与前后处理",
  "HTTP · Tokenizer",
  "S",
  "服务协议、请求预处理与输出处理。",
  "硬件更换时通常复用这些逻辑。",
  "模型与 API 目标不变。",
  "entrypoints/http_server.py",
  null,
  ["api", "tokenizer", "detokenizer"],
);
N(
  "policy",
  "排队 / 调度策略",
  "SchedulePolicy",
  "C",
  "确定等待请求的处理次序。",
  "容量或延迟分布改变后评估策略，未必改代码。",
  "调度改变不应破坏请求隔离和公平性目标。",
  "managers/schedule_policy.py",
);
N(
  "batch",
  "批次与 token 预算",
  "ScheduleBatch",
  "C",
  "组织本轮请求、序列长度及 token 数。",
  "按实际容量调 max tokens、并发等参数。",
  "批次元数据需与执行张量一致。",
  "managers/schedule_batch.py",
  2479,
);
N(
  "prefill-sched",
  "Prefill / Decode 编排",
  "Scheduler",
  "C",
  "选择下一批 prefill 或 decode 工作。",
  "调 chunk 大小和批处理；按目标负载验证首 token 与生成间隔。",
  "Prefill/Decode 语义及 KV 生命周期保持。",
  "managers/scheduler.py",
  3889,
);
N(
  "prefix",
  "前缀复用策略",
  "Radix / Cache",
  "S",
  "按前缀匹配复用已有状态。",
  "布局改变时核对存储接口；匹配语义通常复用。",
  "缓存命中须指向正确模型状态。",
  "mem_cache/unified_radix_cache.py",
);
N(
  "scheduler",
  "调度与批处理",
  "Scheduler",
  "C",
  "排队、连续批处理与每轮 token 预算。",
  "常见变化是容量及参数；不能由换卡直接推断必须改调度算法。",
  "请求语义保持，预算与真实显存容量一致。",
  "managers/scheduler.py",
  445,
  ["policy", "batch", "prefill-sched", "prefix"],
);
N(
  "worker",
  "Worker / 并行入口",
  "TpModelWorker",
  "C",
  "将调度批次交给模型执行并收集结果。",
  "核对设备与并行组；局部内核替换通常复用。",
  "rank、批次与返回结果对齐。",
  "managers/tp_worker.py",
  622,
);
N(
  "forward-batch",
  "设备侧批次描述",
  "ForwardBatch",
  "C",
  "承载本轮 token、位置、序列长度及缓存写入位置。",
  "核对 dtype、host/device 数据与 padding。",
  "所有位置索引、长度和请求顺序一致。",
  "model_executor/forward_batch_info.py",
);
N(
  "runner",
  "模型执行与后端创建",
  "ModelRunner",
  "C",
  "创建后端，并选择 eager、图执行等路径。",
  "在工厂或平台接口接入；避免把设备逻辑散入服务层。",
  "后端实例、ForwardContext 和模型执行路径一致。",
  "model_executor/model_runner.py",
  1105,
);
N(
  "eager",
  "Eager 执行",
  "EagerRunner",
  "C",
  "执行未采用图重放的模型计算。",
  "常作为新算子首次接入的验证路径。",
  "结果与目标精度保持。",
  "model_executor/runner/eager_runner.py",
);
N(
  "executor",
  "Worker 与执行编排",
  "Worker · ModelRunner",
  "C",
  "连接调度批次、模型 forward 和设备执行机制。",
  "选择设备、后端、图及并行方式。",
  "模型结果与批次元数据保持一致。",
  "model_executor/model_runner.py",
  1813,
  ["worker", "forward-batch", "runner", "eager"],
);
N(
  "model-graph",
  "模型结构与数学语义",
  "Qwen2 / Transformer",
  "S",
  "定义模型层次、残差、Attention 和 MLP 的数学关系。",
  "保持模型语义；特殊模型可能需专用实现。",
  "参数含义、因果关系和层间数据语义保持。",
  "models/qwen2.py",
  225,
);
N(
  "projections",
  "QKV / 输出投影",
  "QKV · o_proj",
  "C",
  "在模型语义中组织 QKV 与 head 拼接输出。",
  "通常保留结构；核对分片、head 顺序与量化实现。",
  "head 语义和输出投影输入列顺序一致。",
  "models/qwen2.py",
  225,
);
N(
  "radix",
  "Attention 公共接口",
  "RadixAttention",
  "S",
  "将模型的 Q/K/V 交给当前 Attention 后端。",
  "尽量保持公共接口，让后端承担设备差异。",
  "调用参数和返回张量语义保持。",
  "layers/radix_attention.py",
  114,
);
N(
  "weight-load",
  "加载与权重后处理",
  "ModelLoader",
  "C",
  "加载参数并执行所选量化方法的权重后处理。",
  "换量化格式时检查 checkpoint、scale 与设备内部格式。",
  "参数含义与模型结构保持，存储形式可以改变。",
  "model_loader/loader.py",
);
N(
  "model",
  "模型与公共层接口",
  "models · RadixAttention",
  "S",
  "保持模型结构与数学语义，并调用具体层实现。",
  "硬件专用实现放在下面的后端与算子边界。",
  "形状相同仍需确认 head、token、scale 与 mask 语义。",
  "models/qwen2.py",
  225,
  ["model-graph", "projections", "radix", "weight-load"],
);
N(
  "registry",
  "后端注册 / 创建",
  "ATTENTION_BACKENDS",
  "A",
  "将后端名称映射为实现工厂。",
  "切换已有后端可只改配置；新增后端才需注册和接入选择入口。",
  "名称、模型能力与实际实例一致。",
  "layers/attention/attention_registry.py",
  141,
);
N(
  "metadata",
  "前向元数据",
  "ForwardMetadata",
  "A",
  "准备 block table、序列长度和模式相关信息。",
  "后端契约改变时调整 shape、dtype、所在设备及构造逻辑。",
  "页索引单位和有效长度语义准确。",
  "hardware_backend/npu/attention/ascend_backend.py",
  534,
);
N(
  "attn-prefill",
  "Prefill / Extend",
  "forward_extend",
  "A",
  "处理批量新 token 的 Attention。",
  "选择受支持的融合或其他计算路径。",
  "causal、prefix、mask 和 softmax scale 保持。",
  "hardware_backend/npu/attention/ascend_backend.py",
  1612,
);
N(
  "fia",
  "FIA 分支",
  "npu_fused_infer_attention",
  "A",
  "按条件调用融合推理 Attention。",
  "核对 FIA 版本、输入布局和支持范围。",
  "有效序列长度、KV 布局与算子接口匹配。",
  "hardware_backend/npu/attention/ascend_backend.py",
  3244,
);
N(
  "paged-call",
  "分页 Attention 计算",
  "_npu_paged_attention",
  "A",
  "消费 Q、KV、页表和长度，把结果写入输出。",
  "接入满足接口契约的新厂商实现。",
  "计算语义与数据布局都要匹配。",
  "hardware_backend/npu/attention/ascend_backend.py",
  3310,
);
N(
  "paged",
  "Paged Attention 分支",
  "_npu_paged_attention",
  "A",
  "在满足分支条件时调用 NPU 分页 Attention。",
  "这里是普通 MHA eager Decode 的一个候选内核替换点。",
  "不是全部 Ascend Decode 的唯一执行路径。",
  "hardware_backend/npu/attention/ascend_backend.py",
  3310,
  ["query", "kv-input", "block-table", "seq-lens", "paged-call", "output"],
);
N(
  "native-attn",
  "其他 / Native 分支",
  "AscendTorchNative",
  "A",
  "处理相应特性或其他条件下的计算。",
  "先确认目标工作负载实际走到哪个分支。",
  "不支持的特性应明确识别。",
  "hardware_backend/npu/attention/ascend_torch_native_backend.py",
);
N(
  "decode",
  "Decode 模式与分支",
  "forward_decode",
  "A",
  "根据架构、配置和执行模式选择具体内核。",
  "限定 MHA/MLA、eager/graph 和其他能力范围。",
  "分支条件必须与新内核支持范围一致。",
  "hardware_backend/npu/attention/ascend_backend.py",
  3079,
  ["fia", "paged", "native-attn"],
);
N(
  "query",
  "Query 输入",
  "Q · token / head / dim",
  "C",
  "在该调用点将 Q 组织为 token、head、head_dim。",
  "检查 reshape、stride、dtype 和设备。",
  "THD/HTD 等排列不同不能靠相同元素数判定等价。",
  "hardware_backend/npu/attention/ascend_backend.py",
  3300,
);
N(
  "kv-input",
  "KV 张量视图",
  "k_cache · v_cache",
  "C",
  "向算子提供该层历史 K/V 缓存。",
  "检查物理页布局及读取视图。",
  "读写路径必须采用同一物理布局。",
  "hardware_backend/npu/attention/ascend_backend.py",
  3312,
);
N(
  "block-table",
  "页索引表",
  "ForwardMetadata.block_tables",
  "C",
  "将请求逻辑页映射到 KV 物理页。",
  "page_size 或索引约定改变时同步检查。",
  "单位是何种页/位置、dtype、padding 值须一致。",
  "hardware_backend/npu/attention/ascend_backend.py",
  568,
);
N(
  "seq-lens",
  "有效序列长度",
  "context_lens",
  "C",
  "指定每个请求可读取的历史长度。",
  "核对 CPU 镜像或设备张量及更新时机。",
  "有效长度与 block table 所覆盖的页一致。",
  "hardware_backend/npu/attention/ascend_backend.py",
  3318,
);
N(
  "output",
  "结果布局与输出空间",
  "attn_output",
  "C",
  "分配输出并接收内核结果，再按模型接口拼接 heads。",
  "处理 out 参数或返回值、必要的排列与连续性转换。",
  "shape、dtype、device、head 顺序和数值语义一致。",
  "hardware_backend/npu/attention/ascend_backend.py",
  3304,
);
N(
  "attn-kernel",
  "专用 Attention 内核",
  "torch_npu / sgl_kernel_npu",
  "A",
  "执行实际 Attention 运算。",
  "选择或实现目标芯片支持的内核。",
  "数值精度、mask、scale 和支持形状经过验证。",
  "hardware_backend/npu/attention/ascend_backend.py",
  3310,
);
N(
  "attention",
  "Attention 后端",
  "AscendAttnBackend",
  "A",
  "把公共 Attention 接口转换为昇腾执行路径。",
  "后端注册、元数据、内核及缓存契约是主要接入点。",
  "与模型、KV Cache、图执行保持一致。",
  "hardware_backend/npu/attention/ascend_backend.py",
  313,
  ["registry", "metadata", "attn-prefill", "decode", "attn-kernel"],
);
N(
  "mapping",
  "请求 → token / 页",
  "req_to_token",
  "S",
  "记录请求与缓存位置的映射。",
  "映射语义通常复用，页约定改变时核对转换。",
  "逻辑位置与物理存储对应。",
  "mem_cache/memory_pool.py",
);
N(
  "allocator",
  "分页分配器",
  "PagedTokenToKVPoolAllocator",
  "C",
  "分配、回收 KV 存储位置。",
  "页大小、对齐或分配 kernel 变化时适配。",
  "分配与回收一致，禁止缓存位置重叠。",
  "mem_cache/allocator/paged.py",
);
N(
  "kv-pool",
  "NPU KV 存储池",
  "NPUMHA / NPUMLA Pool",
  "A",
  "分配实际缓存并提供读写接口。",
  "适配页面形状、内部格式与 scatter/cache 写入。",
  "写入格式与 Attention 读取格式一致。",
  "hardware_backend/npu/memory_pool_npu.py",
  88,
  ["kv-write", "kv-read", "kv-size"],
);
N(
  "kv-write",
  "KV 写入",
  "set_kv_buffer",
  "A",
  "把新 token 的 K/V 写到缓存位置。",
  "采用对应 NPU 写入 kernel 与格式。",
  "位置映射、量化 scale 与布局匹配。",
  "hardware_backend/npu/memory_pool_npu.py",
  263,
);
N(
  "kv-read",
  "KV 缓存视图",
  "get_key_buffer / get_value_buffer",
  "C",
  "为 Attention 暴露该层缓存。",
  "核对排列、分片和可能的内部格式。",
  "视图应正确解释 backing storage。",
  "hardware_backend/npu/memory_pool_npu.py",
  88,
);
N(
  "kv-size",
  "显存预算 / 容量",
  "KVCacheConfigurator",
  "C",
  "根据存储成本与显存预算构建缓存池。",
  "重算真实 bytes/token、页填充和 workspace 成本。",
  "不能只按逻辑元素数估算实际容量。",
  "mem_cache/kv_cache_configurator.py",
);
N(
  "hicache",
  "分层缓存 / Offload",
  "HiCache",
  "C",
  "处理设备、主机或存储间的缓存数据。",
  "启用时核对传输 kernel 与布局元数据。",
  "传输前后页内容、格式和层信息一致。",
  "mem_cache/memory_pool_host.py",
);
N(
  "memory",
  "KV Cache 与内存",
  "Pool · Allocator · HiCache",
  "C",
  "管理 KV 生命周期、分页存储及显存容量。",
  "布局变化会传导到读写、分配和容量；算法可保持。",
  "分页索引、物理布局与 Attention 契约一致。",
  "mem_cache/kv_cache_configurator.py",
  2216,
  ["mapping", "allocator", "kv-pool", "hicache"],
);
N(
  "gemm",
  "Linear / GEMM",
  "linear methods",
  "A",
  "执行 QKV、输出投影和 MLP 矩阵乘法。",
  "接入芯片支持的 GEMM 与量化实现。",
  "权重布局、分片与精度一致。",
  "layers/linear.py",
);
N(
  "norm",
  "Norm / RoPE / 激活",
  "BaseFusedOp",
  "A",
  "实现标准层及融合运算。",
  "设备分发和融合 kernel 是主要接入点。",
  "残差、归一化、位置编码语义保持。",
  "layers/layernorm.py",
  641,
);
N(
  "quant-config",
  "量化配置与权重",
  "ModelSlimConfig",
  "A",
  "识别量化方案并选择 Linear/MoE 方法。",
  "核对 checkpoint、scale 和支持精度。",
  "不能直接假设不同厂商量化权重格式等价。",
  "layers/quantization/modelslim/modelslim.py",
  91,
);
N(
  "quant-linear",
  "NPU 量化 Linear",
  "NPU LinearMethod",
  "A",
  "权重后处理、动态量化与量化矩阵乘法。",
  "核对内部格式、scale 传递和 kernel 限制。",
  "精度与量化计算契约一致。",
  "hardware_backend/npu/quantization/linear_method_npu.py",
  65,
);
N(
  "moe",
  "MoE 计算",
  "Ascend MoeRunner",
  "A",
  "组织 expert GEMM、激活与量化计算。",
  "按模型和并行方式适配计算与 dispatch 接口。",
  "expert 顺序与 token 路由一致。",
  "layers/moe/moe_runner/ascend.py",
);
N(
  "sampling",
  "采样与 Logits",
  "Sampler",
  "C",
  "根据 logits 生成下一 token。",
  "选择 NPU 实现；量化实验需固定采样设置。",
  "温度、top-k/top-p、随机性与概率语义保持。",
  "layers/sampler.py",
  861,
);
N(
  "ops",
  "通用 / 融合 / 量化算子",
  "GEMM · Norm · MoE",
  "A",
  "为模型层提供设备上的实际计算。",
  "替换实现、融合算子与格式转换。",
  "保持公共层接口及模型语义。",
  "layers/layernorm.py",
  641,
  ["gemm", "norm", "quant-config", "quant-linear", "moe", "sampling"],
);
N(
  "capture",
  "图捕获",
  "torch.npu.graph",
  "A",
  "捕获受支持的设备执行。",
  "检查 kernel、workspace 和通信的捕获安全性。",
  "捕获不能绑定错误的临时地址。",
  "hardware_backend/npu/graph_runner/npu_graph_runner.py",
  160,
);
N(
  "graph-buffers",
  "静态缓冲与桶",
  "DecodeCudaGraphRunner",
  "C",
  "复用对应 batch/token 桶的输入输出缓冲。",
  "核对 shape、padding 和地址稳定性。",
  "运行时数据应正确更新到捕获地址。",
  "model_executor/runner/decode_cuda_graph_runner.py",
);
N(
  "graph-update",
  "序列长度更新 / 重放",
  "graph.update",
  "A",
  "更新捕获图中的相应序列长度属性。",
  "后端或算子属性变化后核对并重捕获。",
  "旧序列长度和旧地址不能残留。",
  "hardware_backend/npu/graph_runner/npu_graph_runner.py",
  199,
);
N(
  "compile",
  "编译 / 分段图",
  "NPU piecewise backend",
  "C",
  "提供可选的编译和分段图执行路径。",
  "独立核对编译后端与支持范围。",
  "图捕获与 torch.compile 不是同一个机制。",
  "compilation/npu_piecewise_backend.py",
);
N(
  "graph",
  "图执行与编译",
  "NPUGraphRunner",
  "A",
  "降低主机下发开销并管理捕获与重放。",
  "需要真实 NPU 图能力和安全的缓冲更新。",
  "形状、地址、workspace 与更新语义一致。",
  "hardware_backend/npu/graph_runner/npu_graph_runner.py",
  97,
  ["capture", "graph-buffers", "graph-update", "compile"],
);
N(
  "tp",
  "TP 集合通信",
  "NpuCommunicator / HCCL",
  "A",
  "在模型并行组中交换或归约张量。",
  "检查通信库、dtype、分组与拓扑。",
  "所有 rank 的参与次序和张量定义一致。",
  "distributed/device_communicators/npu_communicator.py",
  14,
);
N(
  "ep",
  "EP dispatch / combine",
  "DeepEP-Ascend",
  "A",
  "在 MoE expert 间分发和汇总 token。",
  "只在相关 MoE/EP 路径接入并验证。",
  "路由索引、通信格式与 expert 计算匹配。",
  "layers/moe/moe_runner/ascend.py",
);
N(
  "pd",
  "PD KV 传输",
  "AscendTransferEngine",
  "C",
  "在 Prefill/Decode 实例之间传输 KV。",
  "使用 PD 时核对传输描述、布局与页大小。",
  "发送方与接收方的缓存契约必须一致。",
  "disaggregation/ascend/transfer_engine.py",
  26,
);
N(
  "comm",
  "多卡通信与 KV 传输",
  "HCCL · EP · PD",
  "A",
  "支持模型并行、expert 并行及可选 PD 传输。",
  "更换硬件要接入相应通信栈；局部算子替换未必改动。",
  "分组、次序、数据格式和拓扑一致。",
  "distributed/parallel_state.py",
  103,
  ["tp", "ep", "pd"],
);
N(
  "device",
  "设备与资源操作",
  "NPUDeviceMixin",
  "A",
  "设备选择、显存查询、同步与随机种子等。",
  "对接 torch.npu 和厂商运行时。",
  "设备身份和资源查询准确。",
  "platforms/npu.py",
  15,
);
N(
  "capabilities",
  "能力声明与默认值",
  "PlatformCapabilities",
  "A",
  "声明 Triton、图捕获等平台能力。",
  "只开启已验证能力，设置合理默认值。",
  "声明能力需与实际实现一致。",
  "platforms/interface.py",
  49,
);
N(
  "factories",
  "子系统工厂",
  "SRTPlatform",
  "A",
  "选择 KV Pool、Graph Runner 和编译等实现。",
  "新平台接入时优先检查现有工厂接口。",
  "工厂返回的类须符合接口契约。",
  "platforms/interface.py",
  73,
);
N(
  "platform",
  "设备平台与能力",
  "SRTPlatform · NPU",
  "A",
  "把设备差异集中到平台及子系统入口。",
  "适配设备、默认值、能力声明和工厂。",
  "接口覆盖需逐项检查，不保证全部特性自动可用。",
  "platforms/npu.py",
  76,
  ["device", "capabilities", "factories"],
);
N(
  "torch-npu",
  "PyTorch 设备适配",
  "torch_npu",
  "A",
  "把昇腾设备和相关操作接入 PyTorch。",
  "安装与引擎、驱动、运行时匹配的版本。",
  "相同 Python API 不保证相同硬件执行能力。",
  "hardware_backend/npu/utils.py",
  203,
);
N(
  "kernel-lib",
  "NPU 专用内核",
  "sgl-kernel-npu",
  "A",
  "提供 SGLang 使用的 Ascend C / Triton 专用内核。",
  "编译、注册和调用对应内核。",
  "torch.ops.npu 命名空间中的操作需追到注册来源。",
  "hardware_backend/npu/utils.py",
  210,
);
N(
  "cann",
  "底层运行环境",
  "CANN · Driver · NPU",
  "A",
  "提供芯片运行时、底层算子和设备执行。",
  "按硬件与配套版本部署；底层问题交付最小复现。",
  "运行时、内核与驱动版本和硬件能力匹配。",
  "hardware_backend/npu/utils.py",
  216,
);
N(
  "runtime",
  "厂商软件栈与硬件",
  "torch_npu · CANN · NPU",
  "A",
  "承载真正的设备计算、内存及运行时能力。",
  "这是厂商提供能力与引擎实现连接的位置。",
  "引擎只能使用实际可用的算子与执行能力。",
  "hardware_backend/npu/utils.py",
  203,
  ["torch-npu", "kernel-lib", "cann"],
);

const step = (title, detail, active) => ({ title, detail, active });
export function scenario(state) {
  const map = {},
    notes = {};
  const set = (ids, s, note) =>
    ids.forEach((id) => {
      map[id] = s;
      if (note) notes[id] = note;
    });
  let steps = [],
    title = "";
  if (state.scenario === "overview") return { map: null, notes, steps, title };
  if (state.scenario === "attention") {
    title = "切换 Attention：先判断接口变化范围";
    set(
      ["attention", "attn-kernel", "decode", "paged", "paged-call"],
      "A",
      "替换目标 Attention 执行实现；先限定模型、执行阶段和支持范围。",
    );
    set(
      [
        "registry",
        "metadata",
        "query",
        "kv-input",
        "block-table",
        "seq-lens",
        "output",
        "projections",
        "radix",
      ],
      "C",
      "核对新旧接口；相同契约通常可复用。切换已有后端不等于新增注册代码。",
    );
    steps = [
      step(
        "选择实现",
        "确认实际进入的后端与 Decode 分支；已有后端可通过配置切换。",
        ["attention", "registry", "decode", "attn-kernel"],
      ),
      step(
        "核对契约",
        "检查 shape、dtype、head 顺序、scale、mask 与页表；相同 shape 不保证语义相同。",
        [
          "metadata",
          "query",
          "kv-input",
          "block-table",
          "seq-lens",
          "output",
          "projections",
        ],
      ),
    ];
    if (state.variant === "output") {
      set(
        ["output"],
        "A",
        "新输出排列改变：在适配边界转换回模型要求的 THD，再核对拼接后的列顺序。",
      );
      steps.push(
        step(
          "转换输出",
          "仅输出布局不同：调整 transpose / contiguous 或输出接线；缓存池与调度逻辑通常保持。",
          ["output", "projections", "radix"],
        ),
      );
    }
    if (state.variant === "layout") {
      set(
        [
          "memory",
          "allocator",
          "kv-pool",
          "kv-write",
          "kv-read",
          "metadata",
          "block-table",
          "kv-input",
        ],
        "A",
        "KV 布局或页大小变化：读写、分页分配和页表须一起对齐。",
      );
      set(
        [
          "kv-size",
          "scheduler",
          "batch",
          "prefill-sched",
          "hicache",
          "pd",
          "comm",
        ],
        "C",
        "容量、HiCache 或 PD 描述可能受影响；启用相关特性时验证。无需直接改通信算法。",
      );
      steps.push(
        step(
          "改变 KV 契约",
          "核对缓存写入、物理页、页表与分配器；单独换读侧内核可能读错缓存。",
          [
            "memory",
            "kv-pool",
            "kv-write",
            "kv-read",
            "allocator",
            "metadata",
            "block-table",
          ],
        ),
      );
      steps.push(
        step(
          "传导到容量 / 传输",
          "重算物理存储成本；按需核对调度预算、HiCache 与 PD 两端格式。容量不一定增加。",
          ["kv-size", "scheduler", "batch", "hicache", "pd", "comm"],
        ),
      );
    }
    if (state.graph) {
      set(
        ["graph", "capture", "graph-update"],
        "C",
        "核对捕获安全、输入属性和 workspace。执行内容改变时对受影响图重新捕获。",
      );
      set(
        ["graph-buffers", "executor"],
        "C",
        "检查静态 shape、输出地址和输入更新；不能沿用不匹配的旧捕获图。",
      );
      steps.push(
        step(
          "核对 / 重捕获图",
          "图执行已启用：验证新算子与图输入更新，必要时重捕获；eager 正确不能证明 graph 正确。",
          ["graph", "capture", "graph-buffers", "graph-update", "executor"],
        ),
      );
    }
    steps.push(
      step(
        "检查端到端结果",
        "核验数值与布局；把转换、同步和 workspace 成本一起计入，再观察 TTFT、TPOT 与吞吐。",
        ["attn-kernel", "output", "executor", "attention"],
      ),
    );
  }
  if (state.scenario === "kv") {
    title = "KV 变化：缓存契约如何向外传播";
    set(
      [
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
      "A",
      "缓存页或布局改变，分配、写入、读取与页索引共同适配。",
    );
    set(
      [
        "kv-size",
        "mapping",
        "scheduler",
        "batch",
        "prefill-sched",
        "graph",
        "graph-buffers",
        "graph-update",
        "hicache",
        "comm",
        "pd",
      ],
      "C",
      "按实际存储与启用特性核对容量、图缓冲和跨层/跨实例传输。",
    );
    steps = [
      step(
        "定义新格式",
        "确认 page_size、物理形状、对齐及逻辑位置到物理地址的规则。",
        ["memory", "kv-pool", "allocator"],
      ),
      step(
        "对齐读写两端",
        "写入 kernel、缓存视图、Attention 读取及 block table 同步对齐。",
        [
          "kv-write",
          "kv-read",
          "attention",
          "metadata",
          "block-table",
          "kv-input",
        ],
      ),
      step(
        "核对图与传输",
        "启用图、HiCache 或 PD 时检查缓冲描述、地址与两端布局；必要时重建池并重捕获。",
        ["graph", "graph-buffers", "hicache", "pd", "comm"],
      ),
      step(
        "重算容量与预算",
        "物理开销与碎片可能变化；测量可用 token 容量，再调整并发和 prefill 预算。",
        ["kv-size", "scheduler", "batch", "prefill-sched"],
      ),
      step(
        "验证分页边界",
        "覆盖非满页、跨页、混合长度与连续 Decode；语义与模型权重保持。",
        ["memory", "attention", "model", "executor"],
      ),
    ];
  }
  if (state.scenario === "graph") {
    title = "图执行：下发开销与静态资源的交换";
    set(
      ["graph", "capture", "graph-buffers", "graph-update"],
      "A",
      "启用 NPU 捕获与重放，并管理可复用缓冲和输入更新。",
    );
    set(
      [
        "executor",
        "runner",
        "attention",
        "metadata",
        "seq-lens",
        "attn-kernel",
        "output",
        "ops",
        "gemm",
        "norm",
        "memory",
        "allocator",
        "kv-size",
        "comm",
        "tp",
        "scheduler",
        "batch",
      ],
      "C",
      "检查捕获支持、稳定地址、workspace 与内存预算；是否修改取决于现有实现。",
    );
    steps = [
      step(
        "选择图路径",
        "由执行层选择 NPUGraphRunner；先确认目标工作负载与算子支持捕获。",
        ["executor", "runner", "graph", "capture"],
      ),
      step(
        "固定缓冲与桶",
        "建立对应 shape 桶和缓冲，核对地址稳定、padding、workspace 及通信捕获安全。",
        ["graph-buffers", "allocator", "attn-kernel", "output", "tp"],
      ),
      step(
        "更新再重放",
        "每轮更新 token、序列长度及捕获属性，确保没有使用上一轮的状态。",
        ["graph-update", "metadata", "seq-lens", "forward-batch"],
      ),
      step(
        "核对显存预算",
        "图缓冲可能占额外显存，从而影响可用 KV 容量和并发；需要重测预算。",
        ["memory", "kv-size", "scheduler", "batch"],
      ),
      step(
        "测实际收益",
        "主要候选收益是减少主机下发；仍需测目标 batch 与上下文，不能保证所有负载都更快。",
        ["executor", "graph", "attention"],
      ),
    ];
  }
  if (state.scenario === "quant") {
    title = "权重量化：格式、精度与容量的连锁关系";
    set(
      ["ops", "quant-config", "quant-linear", "gemm", "weight-load"],
      "A",
      "选择支持的 checkpoint/量化方法并接入相应权重与计算实现。",
    );
    set(
      [
        "projections",
        "norm",
        "moe",
        "sampling",
        "executor",
        "graph",
        "capture",
        "graph-buffers",
        "memory",
        "kv-size",
        "scheduler",
        "batch",
        "comm",
        "ep",
      ],
      "C",
      "检查激活、融合、图和 MoE 路径；显存收益需结合 scale、workspace 与硬件支持实测。",
    );
    notes.memory =
      "权重量化本身不等于 KV 量化；主要核对权重节省后可分配给 KV 的预算。";
    notes.attention =
      "仅做权重量化且 Attention 输入/KV 契约保持时，可复用 Attention；KV 量化属于另一项适配。";
    steps = [
      step(
        "识别量化格式",
        "ModelSlim 配置选择方法；核对 checkpoint、scale 与目标芯片支持范围。",
        ["weight-load", "quant-config", "quant-linear"],
      ),
      step(
        "替换 Linear 路径",
        "对齐权重格式、激活 dtype、scale 与量化 GEMM；按需核对 Norm/激活融合。",
        ["gemm", "quant-linear", "norm", "projections"],
      ),
      step(
        "核对图与 MoE",
        "算子或地址改变时核对图；MoE 模型还需确认 expert 计算及通信格式，dense 模型跳过。",
        ["graph", "capture", "graph-buffers", "moe", "ep"],
      ),
      step(
        "重新预算容量",
        "权重与 workspace 成本改变后再计算 KV 预算；权重量化不会自动量化 KV。",
        ["memory", "kv-size", "scheduler", "batch"],
      ),
      step(
        "验证精度与性能",
        "固定采样设置，对比数值、任务质量和端到端性能；量化并不保证所有形状更快。",
        ["model", "sampling", "ops", "executor"],
      ),
    ];
  }
  return { map, notes, steps, title };
}
