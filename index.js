const core = require('@actions/core');
const github = require('@actions/github');

// List of positive emojis (this is a simplified list, you might want to extend it)
const positiveEmojis = [
  '😀', '😃', '😄', '😁', '😆', '😊', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', 
  '😚', '😋', '😛', '😝', '😜', '🤪', '🤗', '🤩', '🥳', '👍', '👏', '🙌', '🤝', '🎉', '🎊',
  '🎈', '🎁', '🎯', '🏆', '🥇', '🥂', '✅', '✨', '⭐', '🌟', '💯', '💪', '👌', '🤙', '🔥',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💕', '💞', '💓', '💗', '💖', '💘', '💝'
];

// Regular expression to match emoji
const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

async function run() {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const daysToCheck = parseInt(core.getInput('days', { required: false })) || 7;
    const bypassMode = core.getInput('bypass-mode').toLowerCase() === 'true';
    
    // Calculate the date for the beginning of the period we're checking
    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - daysToCheck);
    
    const octokit = github.getOctokit(token);
    const context = github.context;
    const repo = context.repo;
    
    // Get all merged PRs from the last week
    const mergedPRs = await octokit.rest.pulls.list({
      owner: repo.owner,
      repo: repo.repo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: 100
    });
    
    // Filter PRs that were merged in the time period
    const recentMergedPRs = mergedPRs.data.filter(pr => {
      if (!pr.merged_at) return false;
      const mergeDate = new Date(pr.merged_at);
      return mergeDate > periodStart;
    });
    
    // Check if any of those PRs have a positive emoji in the title
    const prsWithPositiveEmoji = recentMergedPRs.filter(pr => {
      // Extract all emojis from the title
      const emojisInTitle = pr.title.match(emojiRegex) || [];
      
      // Check if any of the emojis are in our positive emojis list
      return emojisInTitle.some(emoji => positiveEmojis.includes(emoji));
    });
    
    // Log information about what we found
    core.info(`Checking for positive emojis in PR titles merged in the last ${daysToCheck} days`);
    core.info(`Found ${recentMergedPRs.length} merged PRs, of which ${prsWithPositiveEmoji.length} have positive emojis`);
    
    if (prsWithPositiveEmoji.length > 0) {
      // Success! We found at least one merged PR with a positive emoji
      const prLinks = prsWithPositiveEmoji.map(pr => `#${pr.number} - ${pr.title}`).join('\n');
      core.info(`✅ Found these PRs with positive emojis:\n${prLinks}`);
      return;
    }
    
    // No positive emoji PRs found, prepare failure message with instructions
    let message = `❌ No PRs with positive emojis were merged in the last ${daysToCheck} days!\n\n`;
    message += `Your team needs to create and merge a PR with a positive emoji in the title to unblock deployments.\n\n`;
    message += `Positive emoji examples: 😊 👍 🎉 ✨ ❤️\n\n`;
    message += `Create a small PR (e.g., update documentation, add comments) with a positive emoji in the title, get it reviewed and merged, and then retry this workflow.`;
    
    if (bypassMode) {
      core.warning(message);
      core.warning('Running in bypass mode - workflow will continue despite no positive emoji PRs');
    } else {
      core.setFailed(message);
    }
    
  } catch (error) {
    core.setFailed(`Action failed with error: ${error.message}`);
  }
}

run();
