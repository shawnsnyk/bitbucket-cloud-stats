#!/usr/bin/env node
/*
        =========================================================');
        =====THIS PROGRAM IS WORK IN PROGRESS - DO NOT USE!======');
        =========================================================');

        Currently overrides date manually. Should be done in query:
        //Look here for date handling problem if solution is available: https://community.atlassian.com/t5/Bitbucket-questions/Bitbucket-cloud-api-2-0-querying-commits-how-to-filter-on-date/qaq-p/877317#M31927
*/
const INTER_CALLS_DELAY = 1000;

const NBOFDAYS = 90;
var program = require('commander');
const chalk = require('chalk'); //string style
const figlet = require('figlet'); //starwars large text
const axios = require('axios'); //HTTP agent
const moment = require('moment'); //library for processing/ formatting/parsing dates
var debug=false; //See processing for debug
var debugCommitDetail=false; //See processing for debug
var includePublicRepos = true; //true of false to include public repo commits in analysis

var cutOffDate;

const authenticate = (options) => {
  return "";
}

const calculateCutOffDate = () => {
  cutOffDate = moment().subtract(NBOFDAYS, 'days').format('YYYY-MM-DD');
  console.log(chalk.red("Counting commits only after "+cutOffDate));
}
const introText = () => {
  return new Promise((resolve,reject) => {
    figlet.text('SNYK', {
    font: 'Star Wars',
    horizontalLayout: 'default',
    verticalLayout: 'default'
    }, function(err, data) {
      if (err) {
          console.log('Something went wrong...');
          console.dir(err);
          reject(err);
      }
      console.log(data)
      console.log("\n");
      console.log("Snyk tool for counting active contributors");
      resolve();
    });
  });
}

const getDataFromBBAPI = (url, config) => {
  return new Promise((resolve,reject) => {
    if(debug == true)
      {
        console.log('Retrieving data from: ' + url);
      }
    axios.get(url, {auth:{username: config.uid,password: config.token}})
    .then((response) => {
      
      resolve({"data":response.data, "headers":response.headers});
    })
    .catch((error) => {
      console.log('err response');
      reject(error);
    });

  });
}


async function getBBCloudContributorCount (config) {
    var repoData = [];
    var nextUrl = "";
    var arrContributorNames=[];
    var targetUrl = config.apiurl+ "repositories/" + config.username +'/';
    var numUniqueRepos=0
    var numUniquePublicRepos=0
    var numCommits=0;
    nextUrl=targetUrl; //populate first target URL

    while(nextUrl!="") //BB uses pages in API, iterate until all pages processed for repositories
    {
      console.log(nextUrl);
      var responsedata = await getDataFromBBAPI(nextUrl, config);
      var pageSize = responsedata.data.size;
      var curPage = responsedata.data.page;
      
      if(responsedata.data.next)
      {
          if(debug == true) console.log('Next Page - REPO: ' + responsedata.data.next);
          nextUrl=responsedata.data.next;
      }
      else
      {
        if(debug == true) console.log('NO NEXT PAGE - REPO');
        nextUrl="";
      }
      if(debug == true) 
      {
        console.log('Number of repos on page: ' + responsedata.data.values.length)
        console.log('Pagesize:' + pageSize);
        console.log('curPage:' + curPage);
        console.log('For Each Repo:')
      }
  
      console.log('=========Repo Commit Analysis==========');
      
      for (var i = 0, len = responsedata.data.values.length; i < len; i++) {
        
        var is_private = responsedata.data.values[i].is_private; //check if repo is private, by default only these are analyzed
        numUniqueRepos++;

        if(is_private==true)
        {
          console.log(responsedata.data.values[i].full_name + '\t' + ' (Private)');
        }
        else
        {
          numUniquePublicRepos++;
          if(includePublicRepos==false) console.log(responsedata.data.values[i].full_name + '\t' +  ' (Public - Skipping)');
          else
          {
            console.log(responsedata.data.values[i].full_name + '\t' +  ' (Public)');
          }
        }
       
        var commitUrl=responsedata.data.values[i].links.commits.href;// + "?q=date+%3E+" + cutOffDate;
        var nextCommit=commitUrl;
        var numRepoCommits=0;
        //BB uses pages in API, iterate until all pages processed for commits, but only looking at private repos unless overridden
        while(nextCommit!="" && (is_private==true || includePublicRepos==true)) 
        {
          var commitResponsedata = await getDataFromBBAPI(nextCommit, config);
          if(commitResponsedata.data.next)
          {
            if(debug == true) console.log('   Next  page - commit: ' + commitResponsedata.data.next);
            nextCommit= commitResponsedata.data.next
          }
          else
          {
            if(debug == true) console.log('NO NEXT PAGE - COMMIT');
            nextCommit= "";
          }
          var pageCommitSize = commitResponsedata.data.pagelen;
          if(debug == true)
          {
            console.log('     pagelen:' + pageCommitSize);
            console.log('   Number of commits against repo on page: ' + commitResponsedata.data.values.length)
          }
          for (var j = 0, len2 = commitResponsedata.data.values.length; j < len2; j++) 
          {
            //only record name if it's after cuttoffdate.
            if(commitResponsedata.data.values[j].date >= cutOffDate)
            {
              numCommits++;
              numRepoCommits++;
              if(arrContributorNames.indexOf(commitResponsedata.data.values[j].author.raw)<0)
              {
                arrContributorNames.push(commitResponsedata.data.values[j].author.raw);
              }
            } //else, once the dates are found not to be in range, you might be able to abandon commits loop and skip all other commit pages. Research further.
            else //skip future commit pages
            {
              nextCommit="";
              if(debug == true) console.log('   ***Commits date exceed cuttoff, terminating commit processing for repo');
              break;
            }

            if(debugCommitDetail == true)
            {
              var rawSummary= commitResponsedata.data.values[j].summary.raw;
              var summarytxt = "";
              if (rawSummary.length >40)
              {
                summarytxt = '\tSummary: ' + rawSummary.substring(0,40).replace('\n','').replace('\r','').replace('\t','');
              }
              else
              {
                summarytxt = '\tSummary: ' + rawSummary.replace('\n','').replace('\r','').replace('\t','');
              }

              console.log('     repo: ' + commitResponsedata.data.values[j].repository.name +'\tauth: ' + commitResponsedata.data.values[j].author.raw + ' type: ' + commitResponsedata.data.values[j].author.type + '\tdate: ' + commitResponsedata.data.values[j].date + summarytxt);
              if(debug == true) 
              {
                if(cutOffDate>=commitResponsedata.data.values[j].date)
                {
                  console.log('            ****Date does not meet criteria****');
                }
              }
            }
          }
          //if(debug == true) console.log('----Commit Page END------');
        }
        if(debug == true)
        { 
          console.log('     Commits analyzed for repo: ' + numRepoCommits);
          console.log('----Repo Page END------');
        }
      }
    }
     
    console.log('\nTotal Repo Count: ' + numUniqueRepos);
    console.log('Total Private Repo Count: ' + (numUniqueRepos-numUniquePublicRepos));
    console.log('Total Public Repo Count: ' + numUniquePublicRepos);
    console.log('Total Commits Analyzed (Before Cuttoff) Count: ' + numCommits);

    console.log('\n=====Unique Names====');
    for(var nameCounter=0; nameCounter<arrContributorNames.length; nameCounter++)
    {
      console.log(arrContributorNames[nameCounter]);
    }
    console.log('\nUnique User Count:' + arrContributorNames.length);
    console.log('\n=====Script Settings====');
    console.log('debug: ' + debug)
    console.log('debugCommitDetail: ' + debugCommitDetail)
    console.log('includePublicRepos: ' + includePublicRepos)
    return repoData;
  }

  

program
  .version('1.0.0')
  .description('Snyk\'s BitBucket Cloud contributors counter (active in the last 3 months)')
  .usage('<command> [options] \n options: -t <BBAppPassword> -u <BBUid> -r <BBRepoUserName>')

//OATH documentation: https://stackoverflow.com/questions/41519092/using-axios-get-with-authorization-header-in-react-native-app
//App passwords: https://blog.bitbucket.org/2016/06/06/app-passwords-bitbucket-cloud/
//      (Deprecated) how to use api1.0: https://confluence.atlassian.com/bitbucket/app-passwords-828781300.html
//    types of auth: https://developer.atlassian.com/bitbucket/api/2/reference/meta/authentication

  program
    .command('contributorCount')
    .description('Count number of active contributors to BB Cloud repo across an entire organization')
    .option('-t, --apppassword [BBAppPassword]', 'Running command with BB App Password')
    .option('-u, --uid [BBUid]', 'BB Cloud Login User Id')
    .option('-r, --ruid [BBRepoUserName]', 'BB Cloud Repo User Id')
    .action((options) => {
      introText()
      .then(() => {
        var config = {
          username: options.ruid,
          uid: options.uid,
          token:  options.apppassword,
          apiurl: "https://api.bitbucket.org/2.0/"
        };
       
        calculateCutOffDate();
        getBBCloudContributorCount(config)
        .then((data) => {
          //console.log(data);
        })
      })
      .catch((error)=>{
        console.error(error);
      })
      
    });

program.parse(process.argv);

if (program.args.length === 0) program.help();

