
function parse_qemu_log(log) {
    const log_events = [];
    const lines = log.split('\n');

    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();


        if (line.startsWith('CPU Reset')) {
            const cpuMatch = line.match(/CPU Reset \(CPU (\d+)\)/);
            if (cpuMatch) {
                const event = {
                    type: 'cpu_reset',
                    cpu: parseInt(cpuMatch[1]),
                    registers: {}
                };


                i++;
                while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('CPU Reset') && !lines[i].startsWith('Servicing hardware INT') && !lines[i].startsWith('check_exception')) {
                    const regLine = lines[i].trim();
                    parseRegisterLine(regLine, event.registers);
                    i++;
                }

                log_events.push(event);
                continue;
            }
        }


        if (line.startsWith('check_exception')) {
            const excMatch = line.match(/check_exception old:\s*(0x[0-9a-fA-F]+)\s+new\s+(0x[0-9a-fA-F]+)/);
            if (excMatch) {
                const event = {
                    type: 'exception',
                    old_exception: excMatch[1],
                    new_exception: excMatch[2],
                    registers: {}
                };


                i++;
                if (i < lines.length) {
                    const numLine = lines[i].trim();
                    const numMatch = numLine.match(/^\s*(\d+):\s+v=([0-9a-fA-F]+)\s+e=([0-9a-fA-F]+)\s+i=(\d+)\s+cpl=(\d+)\s+IP=([0-9a-fA-F]+):([0-9a-fA-F]+)\s+pc=([0-9a-fA-F]+)\s+SP=([0-9a-fA-F]+):([0-9a-fA-F]+)\s+CR2=([0-9a-fA-F]+)/);
                    if (numMatch) {
                        event.sequence = parseInt(numMatch[1]);
                        event.vector = numMatch[2];
                        event.error_code = numMatch[3];
                        event.interrupt_flag = parseInt(numMatch[4]);
                        event.cpl = parseInt(numMatch[5]);
                        event.ip_segment = numMatch[6];
                        event.ip_offset = numMatch[7];
                        event.pc = numMatch[8];
                        event.sp_segment = numMatch[9];
                        event.sp_offset = numMatch[10];
                        event.cr2 = numMatch[11];
                    }
                }


                i++;
                while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('CPU Reset') && !lines[i].startsWith('Servicing hardware INT') && !lines[i].startsWith('check_exception')) {
                    const regLine = lines[i].trim();
                    parseRegisterLine(regLine, event.registers);
                    i++;
                }

                log_events.push(event);
                continue;
            }
        }


        if (line.startsWith('Servicing hardware INT')) {
            const intMatch = line.match(/Servicing hardware INT=0x([0-9a-fA-F]+)/);
            if (intMatch) {
                const event = {
                    type: 'hardware_int',
                    interrupt: '0x' + intMatch[1],
                    registers: {}
                };


                i++;
                if (i < lines.length) {
                    const numLine = lines[i].trim();
                    const numMatch = numLine.match(/^\s*(\d+):\s+v=([0-9a-fA-F]+)\s+e=([0-9a-fA-F]+)\s+i=(\d+)\s+cpl=(\d+)\s+IP=([0-9a-fA-F]+):([0-9a-fA-F]+)\s+pc=([0-9a-fA-F]+)\s+SP=([0-9a-fA-F]+):([0-9a-fA-F]+)\s+env->regs\[R_EAX\]=([0-9a-fA-F]+)/);
                    if (numMatch) {
                        event.sequence = parseInt(numMatch[1]);
                        event.vector = numMatch[2];
                        event.error_code = numMatch[3];
                        event.interrupt_flag = parseInt(numMatch[4]);
                        event.cpl = parseInt(numMatch[5]);
                        event.ip_segment = numMatch[6];
                        event.ip_offset = numMatch[7];
                        event.pc = numMatch[8];
                        event.sp_segment = numMatch[9];
                        event.sp_offset = numMatch[10];
                        event.eax = numMatch[11];
                    }
                }


                i++;
                while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('CPU Reset') && !lines[i].startsWith('Servicing hardware INT') && !lines[i].startsWith('check_exception')) {
                    const regLine = lines[i].trim();
                    parseRegisterLine(regLine, event.registers);
                    i++;
                }

                log_events.push(event);
                continue;
            }
        }

        i++;
    }

    const filtered_events = log_events.filter(event => event.type !== "hardware_int");
    return filtered_events;
}

function parseRegisterLine(line, registers) {

    const gpRegex = /([A-Z][A-Z0-9_]+)=([0-9a-fA-F]+)/g;
    let match;
    while ((match = gpRegex.exec(line)) !== null) {
        registers[match[1]] = match[2];
    }


    const segMatch = line.match(/^([A-Z]+)\s+=([0-9a-fA-F]+)\s+([0-9a-fA-F]+)\s+([0-9a-fA-F]+)\s+([0-9a-fA-F]+)(\s+.*)?$/);
    if (segMatch) {
        const segName = segMatch[1];
        registers[segName] = {
            selector: segMatch[2],
            base: segMatch[3],
            limit: segMatch[4],
            flags: segMatch[5],
            description: segMatch[6] ? segMatch[6].trim() : ''
        };
    }


    const dtMatch = line.match(/^(GDT|IDT)=\s+([0-9a-fA-F]+)\s+([0-9a-fA-F]+)$/);
    if (dtMatch) {
        registers[dtMatch[1]] = {
            base: dtMatch[2],
            limit: dtMatch[3]
        };
    }


    const fprMatch = line.match(/^(FPR\d+)=([0-9a-fA-F]+)\s+([0-9a-fA-F]+)$/);
    if (fprMatch) {
        registers[fprMatch[1]] = {
            value: fprMatch[2],
            exponent: fprMatch[3]
        };
    }


    const xmmMatch = line.match(/^(XMM\d+)=([0-9a-fA-F]+)\s+([0-9a-fA-F]+)$/);
    if (xmmMatch) {
        registers[xmmMatch[1]] = {
            high: xmmMatch[2],
            low: xmmMatch[3]
        };
    }
}

const EXCEPTION_INFO = {
    '00': {
        name: 'Divide Error (#DE)',
        description: 'Occurs when dividing by zero or when the quotient is too large for the destination.',
        commonCauses: [
            'Division by zero in your code',
            'DIV or IDIV instruction with divisor = 0',
            'Quotient exceeds register size (e.g., dividing 0xFFFFFFFF by 1 into an 8-bit register)'
        ],
        howToFix: 'Check divisor values before division operations. Ensure quotient fits in destination register.'
    },
    '01': {
        name: 'Debug Exception (#DB)',
        description: 'Triggered by debug events such as instruction breakpoints, data breakpoints, or single-step execution.',
        commonCauses: [
            'Hardware breakpoint hit',
            'Single-step mode enabled (TF flag in EFLAGS)',
            'Debug registers (DR0-DR7) configured for watchpoints'
        ],
        howToFix: 'This is usually intentional when debugging. Check if you accidentally enabled debug features.'
    },
    '02': {
        name: 'NMI Interrupt',
        description: 'Non-Maskable Interrupt - a high-priority hardware interrupt that cannot be disabled.',
        commonCauses: [
            'Critical hardware errors',
            'Memory parity errors',
            'System watchdog timer expiration',
            'Hardware button press (on some systems)'
        ],
        howToFix: 'Investigate hardware issues. This usually indicates a serious hardware problem.'
    },
    '03': {
        name: 'Breakpoint (#BP)',
        description: 'Generated by the INT3 instruction, used for software breakpoints in debuggers.',
        commonCauses: [
            'INT3 (0xCC) instruction executed',
            'Debugger breakpoint inserted in code',
            'Intentional trap for debugging'
        ],
        howToFix: 'This is normal during debugging. Remove INT3 instructions if unintended.'
    },
    '04': {
        name: 'Overflow (#OF)',
        description: 'Occurs when the INTO instruction is executed and the overflow flag (OF) is set.',
        commonCauses: [
            'INTO instruction with OF flag set',
            'Signed arithmetic overflow detected',
            'Rarely used in modern code'
        ],
        howToFix: 'Check arithmetic operations for overflow conditions. Avoid INTO instruction unless needed.'
    },
    '05': {
        name: 'BOUND Range Exceeded (#BR)',
        description: 'The BOUND instruction detected that an array index is out of bounds.',
        commonCauses: [
            'BOUND instruction with index outside specified range',
            'Array bounds check failed',
            'Deprecated instruction, rarely used'
        ],
        howToFix: 'Validate array indices before access. Consider using modern bounds checking methods.'
    },
    '06': {
        name: 'Invalid Opcode (#UD)',
        description: 'The processor encountered an instruction it doesn\'t recognize or that is not valid in the current mode.',
        commonCauses: [
            'Executing data as code',
            'Corrupted instruction pointer',
            'Using instructions not supported by the CPU',
            'Attempting privileged instructions in user mode',
            'Jump to wrong memory location'
        ],
        howToFix: 'Verify instruction pointer (EIP/RIP). Check for memory corruption. Ensure CPU feature support.'
    },
    '07': {
        name: 'Device Not Available (#NM)',
        description: 'Attempted to use x87 FPU, MMX, or SSE instructions when the coprocessor is not available.',
        commonCauses: [
            'FPU instruction with EM (Emulation) flag set in CR0',
            'x87 FPU disabled in CR0',
            'TS (Task Switched) flag set in CR0',
            'Trying to use FPU before initialization'
        ],
        howToFix: 'Initialize FPU/SSE properly. Clear TS flag with CLTS instruction. Check CR0 register settings.'
    },
    '08': {
        name: 'Double Fault (#DF)',
        description: 'A second exception occurred while handling another exception. This is a critical error.',
        commonCauses: [
            'Invalid or uninitialized Interrupt Descriptor Table (IDT)',
            'Stack overflow during exception handling',
            'Exception handler itself causes an exception',
            'Invalid stack pointer when handling exception',
            'Null or invalid exception handler'
        ],
        howToFix: 'Verify IDT is properly initialized. Ensure exception handlers are valid. Check stack setup. This often indicates IDT or stack issues.'
    },
    '09': {
        name: 'Coprocessor Segment Overrun',
        description: 'Legacy exception for x87 FPU segment overrun. Not used on modern processors (486+).',
        commonCauses: [
            'Only on very old processors',
            'x87 FPU operand crosses segment boundary'
        ],
        howToFix: 'Should not occur on modern CPUs. Check if running on ancient hardware emulation.'
    },
    '0a': {
        name: 'Invalid TSS (#TS)',
        description: 'Task State Segment (TSS) is invalid during a task switch or when loading segment registers.',
        commonCauses: [
            'TSS selector references invalid descriptor',
            'TSS descriptor has wrong type',
            'TSS limit too small',
            'Task switch to invalid TSS'
        ],
        howToFix: 'Verify TSS descriptor in GDT. Ensure TSS is properly initialized with correct size and type.'
    },
    '0b': {
        name: 'Segment Not Present (#NP)',
        description: 'Tried to load or use a segment register with a descriptor marked as not present.',
        commonCauses: [
            'Segment descriptor has Present bit = 0',
            'Loading segment selector for non-present segment',
            'Accessing memory through absent segment',
            'Uninitialized segment descriptor'
        ],
        howToFix: 'Set Present bit in segment descriptors. Ensure segments are properly loaded before use.'
    },
    '0c': {
        name: 'Stack-Segment Fault (#SS)',
        description: 'Stack operation exceeded stack segment limit or stack segment is not present.',
        commonCauses: [
            'Stack overflow (ESP/RSP beyond segment limit)',
            'SS segment not present',
            'Invalid SS selector',
            'Stack grows beyond segment boundaries',
            'Canonical address violation in long mode'
        ],
        howToFix: 'Increase stack size. Check stack pointer initialization. Verify SS segment descriptor is valid.'
    },
    '0d': {
        name: 'General Protection Fault (#GP)',
        description: 'Generic protection violation - many security and privilege checks failed.',
        commonCauses: [
            'Null pointer dereference (accessing segment 0)',
            'Privilege level violation',
            'Writing to read-only segment',
            'Segment limit exceeded',
            'Invalid descriptor table access',
            'Using wrong segment for operation',
            'Loading invalid selector into segment register'
        ],
        howToFix: 'Check segment selectors and descriptors. Verify privilege levels. Ensure valid memory access patterns.'
    },
    '0e': {
        name: 'Page Fault (#PF)',
        description: 'Attempted memory access that violates page-level protection or references a non-present page.',
        commonCauses: [
            'Accessing non-mapped memory (page not present)',
            'Writing to read-only page',
            'User mode accessing kernel page',
            'Instruction fetch from no-execute page',
            'Invalid page table entry',
            'Null pointer dereference (if paging enabled)',
            'Stack overflow into unmapped memory'
        ],
        howToFix: 'Check CR2 register for faulting address. Map required memory pages. Verify page table setup. Check for buffer overruns.'
    },
    '10': {
        name: 'x87 FPU Error (#MF)',
        description: 'Floating-point error detected by the x87 FPU.',
        commonCauses: [
            'Division by zero in FPU operation',
            'Invalid arithmetic operation',
            'FPU stack overflow/underflow',
            'Denormal operand',
            'Numeric overflow or underflow'
        ],
        howToFix: 'Check FPU status word. Validate floating-point operations. Initialize FPU properly with FINIT.'
    },
    '11': {
        name: 'Alignment Check (#AC)',
        description: 'Unaligned memory access when alignment checking is enabled.',
        commonCauses: [
            'AC flag set in EFLAGS and AM flag set in CR0',
            'Accessing misaligned data (e.g., reading 4-byte int from odd address)',
            'CPL=3 with alignment checking enabled'
        ],
        howToFix: 'Align data structures properly. Disable alignment checking if not needed. Use aligned memory accesses.'
    },
    '12': {
        name: 'Machine Check (#MC)',
        description: 'Critical hardware error detected by the processor or system.',
        commonCauses: [
            'CPU hardware malfunction',
            'Memory errors (ECC failures)',
            'Bus errors',
            'Cache errors',
            'Hardware overheating'
        ],
        howToFix: 'Check Machine Check registers. Investigate hardware issues. This is usually a serious hardware problem.'
    },
    '13': {
        name: 'SIMD Floating-Point Exception (#XM)',
        description: 'SSE/SSE2/SSE3 SIMD floating-point exception occurred.',
        commonCauses: [
            'Invalid SSE operation',
            'SSE denormal operand',
            'SSE divide by zero',
            'SSE overflow/underflow',
            'Unmasked MXCSR exception'
        ],
        howToFix: 'Check MXCSR register for exception flags. Mask unwanted exceptions in MXCSR. Validate SSE operations.'
    },
    '14': {
        name: 'Virtualization Exception (#VE)',
        description: 'EPT violation that cannot be handled conventionally, delivered to guest.',
        commonCauses: [
            'Virtualization-specific exception',
            'EPT misconfiguration in VMX',
            'Guest accessing restricted memory'
        ],
        howToFix: 'Check virtualization configuration. Verify EPT page tables. Used primarily in hypervisors.'
    },
    '15': {
        name: 'Control Protection Exception (#CP)',
        description: 'Control-flow protection violation (CET - Control-flow Enforcement Technology).',
        commonCauses: [
            'Return address mismatch with shadow stack',
            'Indirect jump to non-ENDBRANCH instruction',
            'CET protection violation',
            'ROP/JOP attack detected'
        ],
        howToFix: 'Ensure proper shadow stack usage. Add ENDBRANCH instructions. Check for control flow integrity issues.'
    }
};

const EXCEPTION_NAMES = {};
for (const [key, value] of Object.entries(EXCEPTION_INFO)) {
    EXCEPTION_NAMES[key] = value.name;
}

let allEvents = [];
let currentFilter = 'all';
let selectedEventIndex = null;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    document.getElementById('load-sample').addEventListener('click', loadSampleLog);
    document.getElementById('event-filter').addEventListener('change', handleFilterChange);
});

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        processLog(content);
    };
    reader.readAsText(file);
}

function loadSampleLog() {
    fetch('/sample-log.txt')
        .then(res => res.text())
        .then(data => {
            processLog(data);
        })
        .catch(err => {
            console.error('Error loading sample log:', err);
            showDiagnostic('error', 'Load Error', 'Could not load sample log file');
        });
}

function processLog(logContent) {
    allEvents = parse_qemu_log(logContent);
    console.log('Parsed events:', allEvents);

    updateSummary();
    renderEvents();
    analyzeDiagnostics();
}

function updateSummary() {
    const exceptions = allEvents.filter(e => e.type === 'exception').length;
    const cpuResets = allEvents.filter(e => e.type === 'cpu_reset').length;

    document.querySelector('#total-events .summary-value').textContent = allEvents.length;
    document.querySelector('#exceptions-count .summary-value').textContent = exceptions;
    document.querySelector('#cpu-resets-count .summary-value').textContent = cpuResets;
}

function handleFilterChange(event) {
    currentFilter = event.target.value;
    renderEvents();
}

function renderEvents() {
    const eventsList = document.getElementById('events-list');
    const filteredEvents = currentFilter === 'all'
        ? allEvents
        : allEvents.filter(e => e.type === currentFilter);

    if (filteredEvents.length === 0) {
        eventsList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">📋</span>
                <p>No events to display. Upload a QEMU log file to begin analysis.</p>
            </div>
        `;
        return;
    }

    eventsList.innerHTML = filteredEvents.map((event, index) => {
        const globalIndex = allEvents.indexOf(event);
        return createEventCard(event, globalIndex);
    }).join('');


    eventsList.querySelectorAll('.event-card').forEach((card, index) => {
        card.addEventListener('click', () => {
            const globalIndex = parseInt(card.dataset.index);
            selectEvent(globalIndex);
        });
    });
}

function createEventCard(event, index) {
    let title, info;

    if (event.type === 'exception') {
        const exceptionName = EXCEPTION_NAMES[event.vector] || `Exception 0x${event.vector}`;
        title = exceptionName;
        info = `Vector: 0x${event.vector} | Error: 0x${event.error_code} | IP: ${event.ip_segment}:${event.ip_offset}`;
    } else if (event.type === 'cpu_reset') {
        title = `CPU Reset (CPU ${event.cpu})`;
        info = `EIP: ${event.registers.EIP || '0x00000000'} | CR0: ${event.registers.CR0 || '0x00000000'}`;
    }

    const isSelected = selectedEventIndex === index ? 'selected' : '';

    return `
        <div class="event-card ${isSelected}" data-index="${index}">
            <span class="event-type ${event.type}">${event.type.replace('_', ' ')}</span>
            <div class="event-info">${title}</div>
            <div class="event-meta">${info}</div>
        </div>
    `;
}

function selectEvent(index) {
    selectedEventIndex = index;
    renderEvents();
    renderEventDetails(allEvents[index]);
}

function renderEventDetails(event) {
    const detailsDiv = document.getElementById('event-details');

    if (event.type === 'exception') {
        detailsDiv.innerHTML = renderExceptionDetails(event);
    } else if (event.type === 'cpu_reset') {
        detailsDiv.innerHTML = renderCpuResetDetails(event);
    }
}

function renderExceptionDetails(event) {
    const exceptionInfo = EXCEPTION_INFO[event.vector];
    const exceptionName = exceptionInfo ? exceptionInfo.name : `Unknown Exception`;


    let decoderParam = '';
    if (event.vector === '0e') {
        decoderParam = 'decoder=pf';
    } else if (event.vector === '0d') {
        decoderParam = 'decoder=gp';
    }


    const errorCodeDisplay = decoderParam
        ? `<a href="index.html?${decoderParam}&value=0x${event.error_code}" class="error-code-link">0x${event.error_code}</a>`
        : `0x${event.error_code}`;

    let html = `
        <div class="detail-group">
            <h3>Exception Information</h3>
            <div class="detail-row">
                <div class="detail-label">Exception Type</div>
                <div class="detail-value highlight">${exceptionName}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Vector</div>
                <div class="detail-value">0x${event.vector}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Error Code</div>
                <div class="detail-value">${errorCodeDisplay}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Old Exception</div>
                <div class="detail-value">${event.old_exception}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">New Exception</div>
                <div class="detail-value">${event.new_exception}</div>
            </div>
        </div>
    `;


    if (exceptionInfo) {
        let customDescription = exceptionInfo.description;


        if (event.vector === '0e') {
            const errorCode = parseInt(event.error_code, 16);
            const present = errorCode & 0x1;
            const write = errorCode & 0x2;
            const user = errorCode & 0x4;
            const reserved = errorCode & 0x8;
            const instructionFetch = errorCode & 0x10;

            let specificReason = '';
            if (instructionFetch) {
                specificReason = present
                    ? 'Failed to fetch instruction (protection violation)'
                    : 'Failed to fetch instruction from non-present page';
            } else if (!present) {
                specificReason = 'Accessed non-present page';
            } else if (write) {
                specificReason = 'Violated write to read-only page';
            } else if (reserved) {
                specificReason = 'Reserved bit violation in page table entry';
            } else {
                specificReason = 'Read access caused protection violation';
            }

            const privilegeLevel = user ? 'user mode' : 'supervisor mode';
            customDescription = `${specificReason} while in ${privilegeLevel}.`;
        }

        html += `
        <div class="detail-group exception-explanation">
            <h3>What This Means</h3>
            <div class="explanation-box">
                <div class="explanation-description">${customDescription}</div>
                
                <div class="explanation-section">
                    <div class="explanation-title">Common Causes:</div>
                    <ul class="explanation-list">
                        ${exceptionInfo.commonCauses.map(cause => `<li>${cause}</li>`).join('')}
                    </ul>
                </div>
                
                <div class="explanation-section">
                    <div class="explanation-title">How to Fix:</div>
                    <div class="explanation-fix">${exceptionInfo.howToFix}</div>
                </div>
            </div>
        </div>
        `;
    }

    html += `
        <div class="detail-group">
            <h3>Execution State</h3>
            <div class="detail-row">
                <div class="detail-label">Instruction Pointer</div>
                <div class="detail-value">${event.ip_segment}:${event.ip_offset}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Program Counter</div>
                <div class="detail-value">0x${event.pc}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Stack Pointer</div>
                <div class="detail-value">${event.sp_segment}:${event.sp_offset}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">CR2 (Page Fault)</div>
                <div class="detail-value">0x${event.cr2}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">CPL</div>
                <div class="detail-value">${event.cpl}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Interrupt Flag</div>
                <div class="detail-value">${event.interrupt_flag}</div>
            </div>
        </div>
    `;

    html += renderRegisters(event.registers);

    return html;
}

function renderCpuResetDetails(event) {
    let html = `
        <div class="detail-group">
            <h3>CPU Reset Information</h3>
            <div class="detail-row">
                <div class="detail-label">CPU Number</div>
                <div class="detail-value">${event.cpu}</div>
            </div>
        </div>
    `;

    html += renderRegisters(event.registers);

    return html;
}

function renderRegisters(registers) {
    let html = '';


    const gpRegs = ['EAX', 'EBX', 'ECX', 'EDX', 'ESI', 'EDI', 'EBP', 'ESP', 'EIP', 'EFL'];
    const gpRegData = gpRegs.filter(reg => registers[reg]).map(reg => ({
        name: reg,
        value: registers[reg]
    }));

    if (gpRegData.length > 0) {
        html += `
            <div class="detail-group">
                <h3>General Purpose Registers</h3>
                <div class="register-grid">
                    ${gpRegData.map(reg => `
                        <div class="register-item">
                            <div class="register-name">${reg.name}</div>
                            <div class="register-value">0x${reg.value}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }


    const segRegs = ['ES', 'CS', 'SS', 'DS', 'FS', 'GS'];
    const segRegData = segRegs.filter(reg => registers[reg]).map(reg => ({
        name: reg,
        data: registers[reg]
    }));

    if (segRegData.length > 0) {
        html += `
            <div class="detail-group">
                <h3>Segment Registers</h3>
                ${segRegData.map(reg => `
                    <div class="detail-row">
                        <div class="detail-label">${reg.name}</div>
                        <div class="detail-value">
                            Sel: 0x${reg.data.selector} | 
                            Base: 0x${reg.data.base} | 
                            Limit: 0x${reg.data.limit}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }


    const crRegs = ['CR0', 'CR2', 'CR3', 'CR4'];
    const crRegData = crRegs.filter(reg => registers[reg]).map(reg => ({
        name: reg,
        value: registers[reg]
    }));

    if (crRegData.length > 0) {
        html += `
            <div class="detail-group">
                <h3>Control Registers</h3>
                <div class="register-grid">
                    ${crRegData.map(reg => `
                        <div class="register-item">
                            <div class="register-name">${reg.name}</div>
                            <div class="register-value">0x${reg.value}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    return html;
}

function analyzeDiagnostics() {
    const diagnosticsDiv = document.getElementById('diagnostics-content');
    diagnosticsDiv.innerHTML = '';

    const exceptions = allEvents.filter(e => e.type === 'exception');

    if (exceptions.length > 0) {

        const pageFaults = exceptions.filter(e => e.vector === '0e');
        const gpFaults = exceptions.filter(e => e.vector === '0d');
        const doubleFaults = exceptions.filter(e => e.vector === '08');

        if (doubleFaults.length > 0) {
            showDiagnostic('error', 'Double Fault Detected',
                `Found ${doubleFaults.length} double fault(s). This indicates a severe error in exception handling.`);
        }

        if (pageFaults.length > 5) {
            showDiagnostic('warning', 'Multiple Page Faults',
                `Detected ${pageFaults.length} page faults. Check memory mapping and paging setup.`);
        }

        if (gpFaults.length > 3) {
            showDiagnostic('warning', 'General Protection Faults',
                `Found ${gpFaults.length} GP faults. Verify segment descriptors and privilege levels.`);
        }

        if (exceptions.length > 0 && doubleFaults.length === 0) {
            showDiagnostic('info', 'Exceptions Present',
                `Found ${exceptions.length} exception(s). Review each event for details.`);
        }
    } else {
        showDiagnostic('info', 'No Exceptions',
            'No exceptions found in the log. System appears to be running normally.');
    }
}

function showDiagnostic(type, title, message) {
    const diagnosticsDiv = document.getElementById('diagnostics-content');
    const item = document.createElement('div');
    item.className = `diagnostic-item ${type}`;
    item.innerHTML = `
        <div class="diagnostic-title">${title}</div>
        <div class="diagnostic-message">${message}</div>
    `;
    diagnosticsDiv.appendChild(item);
}
