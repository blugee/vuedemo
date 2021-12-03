$(function(){
  var currentVariantDuplicationIdx = 0;

  var existingPartHTML = 
    '<li>'+
      '<span><%= part.name %> (<%= part.case.name %>)</span>'+
      '<div class="pull-right"><a href="/stores/<%= price.store._id %>'+
      '/parts/<%= price._id %>" data-method="delete" data-csrf="<%= _csrf %>=" '+
      'data-message="This part has been removed from your store." '+
      'data-message-error="Network error. Unable to delete this part from your store at this time." '+
      'class="btn btn-default btn-xs">Remove</a></div>'+
      '<div class="pull-right">'+
        '<input type="text" value="<%= parseFloat(Math.round(price.value * 100) / 100).toFixed(2) %>" '+
          'data-type-timer="" class="form-control input-xs hidden-xs" data-url="/stores/<%= price.store._id %>/parts/<%= price._id %>">'+
        '<a href="/stores/<%= price.store._id %>/parts/<%= price._id %>" class="btn btn-default btn-xs">available</a>'+
      '</div>'+
    '</li>';

  var emptyOptionsHTML = '<p class="empty-options">You don\'t have any options yet</p>'

  var optionLIHTML = '<% _.each(price.options, function(item){ %>'+
    '<tr>'+
      '<td><%= item.name %></td>'+
      '<td><%= item.optionType %></td>'+
      '<td>'+
        '<% if(item.optionType === "radio" || item.optionType === "select" || item.optionType ===  "multi-select" || item.optionType ===  "checkbox") { %>'+
          '<a href="/options/<%= item._id %>/variants/new" class="btn btn-default btn-xs add-choices">Add</a>'+
          '<% if(!item.choices.length) {%>'+
            '<p>No choices</p>'+
          '<% } %>'+
          '<ul class="list-unstyled option-choices">'+
          '<% _.each(item.choices, function(variant) {%>'+
            '<li>'+
              '<%= variant.name %>: '+
              '<select data-change="modifierType" data-url="/variants/<%= variant._id %>">'+
                '<option value="money" <% if(variant.modifierType === "money") { %> selected="selected" <% } %>>$</option>'+
                '<option value="percent" <% if(variant.modifierType === "percent") { %> selected="selected" <% } %>>%</option>'+
              '</select>'+
              '<input type="text" value="<%= variant.modifier %>" data-prop="modifier" data-type-timer data-url="/variants/<%= variant._id %>" class="form-control input-xs hidden-xs" />'+
              '<a href="/variants/<%= variant._id %>" '+
                'class="btn btn-default btn-xs pull-right"'+
                'data-method="delete" '+
                'data-message="This choice has been removed."'+
                'data-message-error="Network error. Unable to delete this variant at this time."'+
                '>Remove</a>'+
              '<% if(variant.active) { %>'+
                '<i class="fa fa-check pull-right"></i>'+
              '<% } else { %>'+
                '<i class="fa fa-times pull-right"></i>'+
              '<% } %>'+
            '</li>'+
          '<%});%>'+
          '</ul>'+
        '<% } else { %>'+
          'N/A'+
        '<% } %>'+
      '</td>'+
      '<td>'+
        '<% if(item.active) { %>'+
          '<i class="fa fa-check"></i>'+
        '<% } else { %>'+
          '<i class="fa fa-times"></i>'+
        '<% } %>'+
      '</td>'+
      '<td>'+
        '<a href="#" class="btn btn-default btn-xs">Edit</a>'+
        '<a href="/stores/<%= price.store %>/options/<%= item._id %>" '+
        'data-method="delete" '+
        'data-message="This option has been removed."'+
        'data-message-error="Network error. Unable to delete this option at this time."'+
        'class="btn btn-default '+
        'btn-xs">Delete</a>'+
      '</td>'+
    '</tr>'+
    '<% }); %>';

  var singleChoiceHTML = '<li>'+
    '<%= name %>: '+
    '<% if(modifierType === "money"){ %>'+
      '$'+
    '<% } %>'+
    '<input type="text" value="<%= modifier %>" data-prop="modifier" data-type-timer data-url="/variants/<%= _id %>" class="form-control input-xs hidden-xs" />'+
    '<% if(modifierType === "percent") { %>'+
      '%'+
    '<% } %>'+
    '<a href="/variants/<%= _id %>" '+
      'data-method="delete" '+
      'data-message="This choice has been removed."'+
      'data-message-error="Network error. Unable to delete this variant at this time."'+
    'class="btn btn-default btn-xs pull-right">Remove</a>'+
    '<% if(active) { %>'+
      '<i class="fa fa-check pull-right"></i>'+
    '<% } else { %>'+
      '<i class="fa fa-times pull-right"></i>'+
    '<% } %>'+
  '</li>'

  var addChoiceFormHTML = '';

  var searchAutocomplete = function($searchInput, $list) {
    $searchInput.keyup(function () {
      var filter = $(this).val();
      $list.each(function () {
        if ($(this).text().search(new RegExp(filter, "i")) < 0) {
          $(this).hide();
        } else {
          $(this).show()
        }
      });
    });
  };

  var updatePrice = function(url, toSend, successCallback, errorCallback) {
    $.ajax({
      url: url,
      type: 'PUT',
      data: toSend,
      dataType: 'json',
      success: function(data) {
        successCallback(data);
      },
      error: function() {
        errorCallback();
        bsAlert('danger','Network error: Unable to update at this time.');
      }
    });
  };

  $(document).on('click', '.price-availability', function(e) {
    e.preventDefault();
    var $this = $(this);
    updatePrice(
      $this.attr('href'),
      // !! for boolean ! for not. So the opposite of a boolean
      ('available=' + !!!parseInt($this.attr('data-available'))),
      function(data) {
        $this.attr('data-available',data.price.available | 0);
        if(data.price.available) {
          $this.text('available');
        } else {
          $this.text('unavail');
        }
      },
      function() {

      }
    )
  });

  $(document).on('mcb:donetyping', function(e, $input) {
      var newValue = $input.val();
      var prop = 'value';
      if(typeof $input.attr('data-prop') !== 'undefined') {
        prop = $input.attr('data-prop');
      }
      updatePrice(
        $input.attr('data-url'),
        (prop + '=' + newValue),
        function(data){},
        function(){}
      )
  });

  $(document).on('click', '.options', function(e) {
    e.preventDefault();
    var $this = $(this);
    var $optionsList = $this
      .closest('li')
      .find('.options-list');
    var showAfter = false;
    if(!$optionsList.is(':visible')){
      showAfter = true;
    }
    $('#parts-list .options-list')
      .hide()
      .find('.empty-options')
      .remove()
      .end()
      .find('tbody')
      .empty();
    if(showAfter) {
      $optionsList.show();  
    }
    if($optionsList.is(':visible')){
      $.getJSON($this.attr('href'), function(data) {
        var compiledOptionItemTemplate;
        var compiledEmptyOptionsTemplate;
        if(!data.price.options.length) {
          compiledEmptyOptionsTemplate = _.template(emptyOptionsHTML);
          $optionsList.prepend(compiledEmptyOptionsTemplate());
          return;
        }
        compiledOptionItemTemplate = _.template(optionLIHTML);
        $optionsList
          .find('tbody')
          .append(compiledOptionItemTemplate(data));
      });  
    }
  });

  var updateAddChoiceFormHTML = function() {
    addChoiceFormHTML = $('.add-choice-form')
      .find('.duplicate-me')
      .clone()
      .removeClass('duplicate-me')
      .get(0)
      .outerHTML
  };

  $(document).on('click', '#add-choice', function(e) {
    e.preventDefault();
    var $this = $(this);
    var duplicateTextfield = addChoiceFormHTML
      .replace(/\$\$/g,currentVariantDuplicationIdx)
      .replace(/\%\%/g,++currentVariantDuplicationIdx);
    $this
      .closest('.form-group')
      .before(duplicateTextfield);
  });

  $(document).on('click', '.add-choices', function(e) {
    e.preventDefault();
    var $this = $(this);
    var urlToAddChoice = $this.attr('href');
    currentVariantDuplicationIdx = 0;
    bootbox.dialog({
      title: 'New Choice',
      message: $('.add-choice-form')
        .clone()
        .find('form')
        .attr('id', 'new-choice-form')
        .end()
        .html()
        .replace(/\$\$/g,currentVariantDuplicationIdx)
        .replace(/%%/g,++currentVariantDuplicationIdx),
      buttons: {
        success: {
          label: 'Save Choices',
          className: 'btn-success',
          callback: function() {
            var serializedChoices = $('#new-choice-form').serialize();
            $.post(urlToAddChoice, serializedChoices, function(data) {
              var compiledSingleChoiceTemplate = _.template(singleChoiceHTML);
              var $choiceList = $this
                .closest('td')
                .find('ul');
              $choiceList.empty();

              data.option.choices.forEach(function(choice) {
                $choiceList.append(compiledSingleChoiceTemplate(choice));
              })
            });
          }
        }
      }
    });
  });

  $(document).on('click', '.new-option', function(e) {
    e.preventDefault();
    var $this = $(this);
    var newOptionUrl = $this.attr('href');
    bootbox.dialog({
      title: 'New Option',
      message: $('.case-options-form')
        .clone()
        .find('form')
        .attr('id','new-option-form')
        .end()
        .html(),
      buttons: {
        success: {
          label: 'Create Option',
          className: 'btn-success',
          callback: function() {
            var serializedOptions = $('#new-option-form').serialize();  
            $.post(newOptionUrl,
              serializedOptions, 
              function(data){
                var option  = data.option;
                var priceObj = {
                  price: {
                    options: [
                      option
                    ],
                    store: data.price.store
                  }
                };
                var $optionsList = $this.closest('.options-list');
                var compiledOptionItemTemplate = _.template(optionLIHTML);
                $optionsList.find('tbody')
                  .append(compiledOptionItemTemplate(priceObj));
              }
            );
          }
        }
      }
    });
  });

  $(document).on('mcb:datamethod:ok', function(e, $this, method, url, data) {
    if($this.hasClass('add-part')) {
      data._csrf = $this.attr('data-csrf');
      var compiledPartTemplate = _.template(existingPartHTML);
      $('#parts-list').append(compiledPartTemplate(data));
    }
    if($this.hasClass('add-choice')) {
    }
  });
  
  searchAutocomplete($('#search-parts'), $('#parts-list li'));
  searchAutocomplete($('#search-all-parts'), $('#full-parts-list li'));
  updateAddChoiceFormHTML();
});