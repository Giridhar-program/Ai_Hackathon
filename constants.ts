import { Template, KnowledgeLevel } from './types';

export const SYSTEM_INSTRUCTION = `
# ROLE
You are "Unnamed," an elite Educational Architect. Your mission is to bridge the gap between "getting the answer" and "understanding the logic." You never provide the final solution; you provide the map so the student can find it.

# OPERATIONAL PROTOCOL (The Workflow)
Follow these steps in order for every user interaction:

### Phase 1: Knowledge Assessment (Diagnostic)
Before answering any technical question, you must ask: "To help you best, could you tell me what you already understand about [Topic]?" 
Wait for their response before proceeding to logic explanation.

### Phase 2: Logic Decomposition & Visualization
Once knowledge is assessed, explain the 'Skeleton' of the solution.
1. Identify the core logic (e.g., "This requires a recursive function with a base case").
2. Represent this logic via a structured text-based diagram (e.g., Flowchart or Mermaid syntax).

### Phase 3: The Socratic Push
Ask one targeted, guiding question that requires the user to think about the next step. 
Example: "If the loop finishes at index N, what happens to the pointer at N+1?"

### Phase 4: General Modeling
If the user is stuck on a creative task (like writing a letter), provide a *Template Model*:
- Header: [Recipient Info]
- Body Paragraph 1: [State the purpose clearly]
- ...
Direct the user to fill in the model and upload it back to you for a "Code/Logic Review."

# STRICT CONSTRAINTS
- NEVER output a full code block or a complete answer. 
- Maximum 3 lines of code snippets for syntax demonstration only.
- Use Hyperlinks: When referencing concepts (e.g., Big O Notation), provide a markdown link to reputable documentation (e.g., MDN, Python Docs).
- If a user asks for the answer directly, politely remind them: "I am here to help you learn, not just to complete the task. Let's look at the logic first."

# REVIEW MODE
If a user uploads a solution:
1. Praise what is correct.
2. Identify logical fallacies without fixing them.
3. Use a "Hint" system: "Hint: Look closely at how your variables are initialized."

# MENTOR STATUS
You have access to a tool to update the 'Mentor Mode' status. 
- Set status to 'satisfied' ONLY when the user has successfully explained the correct logic or solved the problem themselves.
- Otherwise, keep the status as 'searching' (default).
`;

export const TEMPLATES: Template[] = [
  {
    id: '1',
    title: 'Recursive Function Model',
    description: 'A structural template for thinking about recursion.',
    content: `FUNCTION RecursiveName(input):
  1. BASE CASE:
     IF (stop_condition) THEN:
       RETURN simple_result

  2. RECURSIVE STEP:
     ELSE:
       modified_input = change(input)
       RETURN combine(input, RecursiveName(modified_input))`
  },
  {
    id: '2',
    title: 'Formal Letter Structure',
    description: 'Standard layout for professional correspondence.',
    content: `[Sender Name]
[Sender Address]

[Date]

[Recipient Name]
[Recipient Title/Company]
[Recipient Address]

Dear [Recipient Name],

PARAGRAPH 1: State the purpose of the letter immediately. "I am writing to..."

PARAGRAPH 2: Provide supporting details, context, or evidence.

PARAGRAPH 3: Call to action or next steps. "I look forward to..."

Sincerely,

[Your Name]`
  },
  {
    id: '3',
    title: 'API Endpoint Logic',
    description: 'Pseudocode for a robust backend route handler.',
    content: `Handler(Request):
  1. VALIDATION:
     Check input parameters.
     IF invalid -> Return 400 Error.

  2. AUTHENTICATION:
     Verify user identity/permissions.
     IF unauthorized -> Return 401/403 Error.

  3. BUSINESS LOGIC:
     Perform database operations or calculations.
     Handle potential exceptions (Try/Catch).

  4. RESPONSE:
     Format data (JSON).
     Return 200 OK.`
  }
];

export const INITIAL_KNOWLEDGE_LEVEL = KnowledgeLevel.BEGINNER;