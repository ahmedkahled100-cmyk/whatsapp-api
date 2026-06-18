const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./scratch/yt.json', 'utf8'));

let result = { title: '', avatar: '', subs: '', videos: '' };

function findValues(obj) {
  if (!obj || typeof obj !== 'object') return;
  
  if (obj.channelMetadataRenderer) {
    result.title = obj.channelMetadataRenderer.title;
    result.avatar = obj.channelMetadataRenderer.avatar?.thumbnails?.[0]?.url;
  }
  
  if (obj.subscriberCountText?.simpleText) {
    result.subs = obj.subscriberCountText.simpleText;
  }
  
  if (obj.pageHeaderViewModel) {
    const metaParts = obj.pageHeaderViewModel.metadata?.contentMetadataViewModel?.metadataRows?.[1]?.metadataParts;
    if (metaParts) {
      metaParts.forEach(part => {
        if (part.text?.content?.includes('subscribers') || part.text?.content?.includes('مشترك')) result.subs = part.text.content;
        if (part.text?.content?.includes('videos') || part.text?.content?.includes('فيديو')) result.videos = part.text.content;
      });
    }
    
    if(!result.title) result.title = obj.pageHeaderViewModel.title?.dynamicTextViewModel?.text?.content;
    if(!result.avatar) result.avatar = obj.pageHeaderViewModel.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources?.[0]?.url;
  }

  Object.values(obj).forEach(findValues);
}

findValues(data);
console.log(JSON.stringify(result, null, 2));
