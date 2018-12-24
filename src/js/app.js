App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,
  hasLoggedIn: false,
  signedData: "",
  signedAddress: "0",

  init: function() {
    return App.initWeb3();
  },

  initWeb3: function() {
    // TODO: refactor conditional
    if (typeof web3 !== 'undefined') {
      // If a web3 instance is already provided by Meta Mask.
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    } else {
      // Specify default instance if no web3 instance provided
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      web3 = new Web3(App.web3Provider);
    }
    return App.initContract();
  },

  initContract: function() {
    $.getJSON("Members.json", function(members) {
      // Instantiate a new truffle contract from the artifact
      App.contracts.Members = TruffleContract(members);
      // Connect provider to interact with contract
      App.contracts.Members.setProvider(App.web3Provider);

      App.listenForEventsMembers();

      //return App.render();
    }).then(function(){
        $.getJSON("Election.json", function(election) {
        // Instantiate a new truffle contract from the artifact
        App.contracts.Election = TruffleContract(election);
        // Connect provider to interact with contract
        App.contracts.Election.setProvider(App.web3Provider);

        App.listenForEvents();

        return App.render();
      });
    });

    
  },

  // Listen for events emitted from the contract
  listenForEvents: function() {
    App.contracts.Election.deployed().then(function(instance) {
      // Restart Chrome if you are unable to receive this event
      // This is a known issue with Metamask
      // https://github.com/MetaMask/metamask-extension/issues/2393
      instance.votedEvent({}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        console.log("event triggered", event)
        // Reload when a new vote is recorded
        App.render();
      });          
    });
  },

  listenForEventsMembers: function(){
    App.contracts.Members.deployed().then(function(membersInstance){
      membersInstance.signUpEvent({}, {
        fromBlock: 0,
        toBlock: 'latest'
      }).watch(function(error, event) {
        console.log("event triggered", event)
        // Reload when a new vote is recorded
        App.render();
      });  
    });
  },

  loadElectionResults: function(){
    console.log("loadElectionResults is called");
    var electionInstance, membersInstance;
    var loader = $("#loader");
    var content = $("#content");

    loader.show();
    content.hide();

        // Load account data
    web3.eth.getCoinbase(function(err, account) {
      if (err === null) {
        App.account = account;
        $("#accountAddress").html("Your Account: " + account);
      }
    });

// Load contract data
    App.contracts.Election.deployed().then(function(instance) {
      electionInstance = instance;
      return electionInstance.candidatesCount();
    }).then(function(candidatesCount) {
      var candidatesResults = $("#candidatesResults");
      candidatesResults.empty();

      var candidatesSelect = $('#candidatesSelect');
      candidatesSelect.empty();

      for (var i = 1; i <= candidatesCount; i++) {
        console.log(i);
        electionInstance.candidates(i).then(function(candidate) {
          var id = candidate[0];
          var name = candidate[1];
          var voteCount = candidate[2];

          // Render candidate Result
          var candidateTemplate = "<tr><th>" + id + "</th><td>" + name + "</td><td>" + voteCount + "</td></tr>"
          candidatesResults.append(candidateTemplate);

          // Render candidate ballot option
          var candidateOption = "<option value='" + id + "' >" + name + "</ option>"
          candidatesSelect.append(candidateOption);
        });
      }
      return electionInstance.voters(App.account);
    }).then(function(hasVoted) {
      // Do not allow a user to vote
      if(hasVoted) {
        $("#voteForm").hide();
      }
      loader.hide();
      //content.show();
    }).catch(function(error) {
      console.warn(error);
    });
  },

  render: function() {
    console.log("render is called");
    var membersInstance;
    var loader = $("#loader");
    var content = $("#content");

    loader.show();
    content.hide();

    // Load account data
    web3.eth.getCoinbase(function(err, account) {
      if (err === null) {
        App.account = account;
        $("#accountAddress").html("Your Account: " + account);
      }
    });    

    App.contracts.Members.deployed().then(function(instance){
      membersInstance = instance;
      return membersInstance.members(App.account);
    }).then(function(hasSignedUp){
      loader.hide();
      if(hasSignedUp){
        $("#signUpForm").hide();
        if(App.hasLoggedIn){
          $("#loginForm").hide();
          $("#logoutForm").show();          
          App.loadElectionResults();
          content.show();
        } else {
          $("#loginForm").show();
          $("#logoutForm").hide();
        }
      } else {
        $("#signUpForm").show();
        $("#loginForm").hide();
        $("#logoutForm").hide();
        content.hide();
      }
    });

    },

  castVote: function() {
    var candidateId = $('#candidatesSelect').val();
    App.contracts.Election.deployed().then(function(instance) {
      return instance.vote(candidateId, { from: App.account });
    }).then(function(result) {
      // Wait for votes to update
      $("#content").hide();
      $("#loader").show();
    }).catch(function(err) {
      console.error(err);
    });
  },

  signUpClick: function() {
    App.contracts.Members.deployed().then(function(instance) {
      return instance.signUp({ from: App.account });
    }).then(function(result) {

                  

      $("#content").hide();
      $("#loader").show();
    }).catch(function(err) {
      console.error(err);
    });
  },

  loginClick: async function() {
    App.contracts.Members.deployed().then(function(instance) {
      console.log("clicked to the login");
      return instance.members(App.account);
    }).then( async function(result) {
      //console.log(result);
      App.hasLoggedIn = result;

      account = App.account;
      console.log("inside account " + account);

      async function startRecover(account, signature){
        var message = "Some string";
        var hash = web3.sha3(message);
        await web3.personal.ecRecover(hash, signature, (err, res) => {
          if (res === App.account){
            $("#content").hide();
            $("#loader").show();
            App.render();
          }
        });
      }

      async function startSign(account){
        var message = "Some string";
        var hash = web3.sha3(message);
        let signature = "asdsasd";
        console.log("account " + account);

        await window.web3.personal.sign(hash, account, async (err, res) => {
          console.log("Error:" + err);
          console.log("Res:" + res);
          await startRecover(App.account, res);
        });
      }      

      await startSign(account);
      
    }).catch(function(err) {
      console.error(err);
    });
  },

  logoutClick: function() {
    console.log("clicked to the logout");
    App.hasLoggedIn = false;
    App.render();
  },

};

$(function() {
  $(window).load(function() {
    App.init();
  });
});
