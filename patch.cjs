const fs = require('fs');
let content = fs.readFileSync('src/components/UserProfile.tsx', 'utf8');

const regex = /\{activeTab === "experience" && \([\s\S]+?\<table className="w-full border-collapse mt-2"\>[\s\S]+?<\/table>\s*<\/div>\s*<\/div>\s*\)\}/;

const match = content.match(regex);
if (match) {
  const kyorugiBlock = match[0].replace('<span>Referee Experience</span>', '<span>Kyorugi Experience</span>');
  const poomsaeBlock = match[0]
                         .replace('activeTab === "experience"', 'activeTab === "poomsae_experience"')
                         .replace('<span>Referee Experience</span>', '<span>Poomsae Experience</span>')
                         .replace(/experienceHistory/g, 'poomsaeExperienceHistory');
                         
  content = content.replace(regex, kyorugiBlock + '\n\n          ' + poomsaeBlock);
  fs.writeFileSync('src/components/UserProfile.tsx', content);
  console.log('Success');
} else {
  console.log('Match not found');
}
