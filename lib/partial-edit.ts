import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ActionType, processPatch } from "./apply-patch";
import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

/**
 * Generate a patch based on the original content and a requested task
 * The patch follows a custom format to add, update, delete, or move code.
 */
const partialEditSchema = z.object({
    originalContent: z.string().describe("The original content of the file to be edited"),
    task: z.string().describe("The task description of what changes should be made to the code")
});

/**
 * Extracts the patch text from the LLM response
 * @param response - The raw response from the LLM
 * @returns The extracted patch text
 */
function extractPatchFromResponse(response: string): string {
    // Find content between Begin Patch and End Patch
    const beginMarker = "*** Begin Patch";
    const endMarker = "*** End Patch";

    const beginIndex = response.indexOf(beginMarker);
    const endIndex = response.indexOf(endMarker);

    if (beginIndex === -1 || endIndex === -1 || beginIndex >= endIndex) {
        throw new Error("Invalid patch format in LLM response");
    }

    // Extract and return the patch, including the markers
    return response.substring(beginIndex, endIndex + endMarker.length);
}

/**
 * Creates a patch in the V4A diff format and applies it to the original content
 * @param originalContent - The content to be edited
 * @param task - Description of what changes to make
 * @returns An object containing the patch and final content
 */
async function generatePatchAndApply(
    { originalContent, task }: { originalContent: string; task: string }
): Promise<string> {
    // Create a temporary file name for compatibility with apply-patch
    const tempFileName = "origin.tmp";

    // Store the original content
    const files = {
        [tempFileName]: originalContent
    };

    // Create system message for the LLM to understand the task
    const systemPromptContent = `
You are an expert code editor. Your task is to generate a patch in the V4A diff format based on the original content and the requested changes.

The patch format must follow this structure:
*** Begin Patch
*** Update File: ${tempFileName}
@@ context_identifier (if needed)
 [context line]
-[line to remove]
+[line to add]
 [context line]
*** End Patch

For multiple changes in the same file, you can use multiple sections:
*** Begin Patch
*** Update File: ${tempFileName}
@@ first_context_identifier
 [context line]
-[line to remove]
+[line to add]
 [context line]
@@
 [another context line]
-[another line to remove]
+[another line to add]
 [another context line]
*** End Patch

Important rules:
1. Context lines should start with a space
2. Lines to be removed should start with a minus sign
3. Lines to be added should start with a plus sign
4. Use @@ to specify function or class context if needed
5. Only include lines that change or provide context
6. Don't use line numbers, rely on context to identify code
7. Include about 3 lines of context before and after changes
8. For multiple changes, separate them with @@ markers

PLEASE ONLY GENERATE THE PATCH TEXT, NOTHING ELSE.
`;

    // Initialize the ChatOpenAI model with GPT-4.1
    const model = new ChatOpenAI({
        model: "gpt-4.1",
        temperature: 0.2 // Lower temperature for more deterministic outputs
    });

    // Prepare messages for the model
    const messages = [
        new SystemMessage(systemPromptContent),
        new HumanMessage(`Original content:\n\n${originalContent}\n\nTask: ${task}`)
    ];

    // Call the model
    const response = await model.invoke(messages);

    // Extract content from the response
    const responseContent = response.content.toString();

    // Extract the patch from the LLM response
    let fullPatch: string;
    try {
        fullPatch = extractPatchFromResponse(responseContent);
    } catch (error) {
        // If we can't extract a properly formatted patch, fall back to a simple one
        console.error("Error extracting patch from LLM response:", error);
        fullPatch = `*** Begin Patch\n*** Update File: ${tempFileName}\n // Could not properly generate patch\n*** End Patch`;
    }

    // Apply the patch to get the final content
    const result = processPatch(fullPatch, files);
    const finalContent = result[tempFileName] || "";

    // Return a formatted response with both patch and final content
    return JSON.stringify({
        patch: fullPatch,
        finalContent: finalContent
    });

}

/**
 * A LangChain tool for partial code editing
 * Takes original content and a task description, returns a patch and the edited content
 */
export const partialEditTool = tool(
    generatePatchAndApply,
    {
        name: "partial_edit",
        description: "Generates a patch and applies it to edit code based on a task description",
        schema: partialEditSchema
    }
);

/**
 * A simplified function to perform partial editing without using the LangChain tool directly
 */
export async function partialEdit(originalContent: string, task: string): Promise<{
    patch: string;
    finalContent: string;
}> {
    const resultJson = await partialEditTool.invoke({
        originalContent,
        task
    });

    // Parse the JSON result
    const result = JSON.parse(resultJson);

    return {
        patch: result.patch,
        finalContent: result.finalContent
    };
}
