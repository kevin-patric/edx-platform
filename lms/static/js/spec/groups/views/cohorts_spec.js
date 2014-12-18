define(['backbone', 'jquery', 'js/common_helpers/ajax_helpers', 'js/common_helpers/template_helpers',
        'js/groups/views/cohorts', 'js/groups/collections/cohort', 'js/groups/models/content_group'],
    function (Backbone, $, AjaxHelpers, TemplateHelpers, CohortsView, CohortCollection, ContentGroupModel) {
        describe("Cohorts View", function () {
            var catLoversInitialCount = 123, dogLoversInitialCount = 456, unknownUserMessage,
                createMockCohort, createMockCohorts, createMockContentGroups, createCohortsView, cohortsView,
                requests, respondToRefresh, verifyMessage, verifyNoMessage, verifyDetailedMessage, verifyHeader,
                expectCohortAddRequest, getAddModal;

            createMockCohort = function (name, id, user_count) {
                return {
                    id: id || 1,
                    name: name,
                    user_count: user_count || 0
                };
            };

            createMockCohorts = function (catCount, dogCount) {
                return {
                    cohorts: [
                        createMockCohort('Cat Lovers', 1, catCount || catLoversInitialCount),
                        createMockCohort('Dog Lovers', 2, dogCount || dogLoversInitialCount)
                    ]
                };
            };

            createMockContentGroups = function () {
                return [
                    new ContentGroupModel({id: 0, name: 'Harvard Alumnae'}),
                    new ContentGroupModel({id: 1, name: 'MIT Alumnae'})
                ];
            };

            createCohortsView = function (test, options) {
                var cohortsJson, cohorts, contentGroups;
                options = options || {};
                cohortsJson = options.cohorts ? {cohorts: options.cohorts} : createMockCohorts();
                cohorts = new CohortCollection(cohortsJson, {parse: true});
                contentGroups = options.contentGroups || createMockContentGroups();
                cohorts.url = '/mock_service/cohorts';
                requests = AjaxHelpers.requests(test);
                cohortsView = new CohortsView({
                    model: cohorts,
                    contentGroups: contentGroups,
                    upload_cohorts_csv_url: "http://upload-csv-file-url/"
                });
                cohortsView.render();
                if (options && options.selectCohort) {
                    cohortsView.$('.cohort-select').val(options.selectCohort.toString()).change();
                }
            };

            respondToRefresh = function(catCount, dogCount) {
                AjaxHelpers.respondWithJson(requests, createMockCohorts(catCount, dogCount));
            };

            expectCohortAddRequest = function(name) {
                AjaxHelpers.expectJsonRequest(
                    requests, 'POST', '/mock_service/cohorts',
                    {
                        name: name,
                        user_count: 0,
                        assignment_type: '',
                        group_id: null
                    }
                );
            };

            getAddModal = function() {
                return cohortsView.$('.cohort-management-add-modal');
            };

            verifyMessage = function(expectedTitle, expectedMessageType, expectedAction, hasDetails) {
                expect(cohortsView.$('.message-title').text().trim()).toBe(expectedTitle);
                expect(cohortsView.$('div.message')).toHaveClass('message-' + expectedMessageType);
                if (expectedAction) {
                    expect(cohortsView.$('.message-actions .action-primary').text().trim()).toBe(expectedAction);
                }
                else {
                    expect(cohortsView.$('.message-actions .action-primary').length).toBe(0);
                }
                if (!hasDetails) {
                    expect(cohortsView.$('.summary-items').length).toBe(0);
                }
            };

            verifyNoMessage = function() {
                expect(cohortsView.$('.message').length).toBe(0);
            };

            verifyDetailedMessage = function(expectedTitle, expectedMessageType, expectedDetails, expectedAction) {
                var numDetails = cohortsView.$('.summary-items').children().length;
                verifyMessage(expectedTitle, expectedMessageType, expectedAction, true);
                expect(numDetails).toBe(expectedDetails.length);
                cohortsView.$('.summary-item').each(function (index) {
                    expect($(this).text().trim()).toBe(expectedDetails[index]);
                });
            };

            verifyHeader = function(expectedCohortId, expectedTitle, expectedCount) {
                var header = cohortsView.$('.cohort-management-group-header');
                expect(cohortsView.$('.cohort-select').val()).toBe(expectedCohortId.toString());
                expect(cohortsView.$('.cohort-select option:selected').text()).toBe(
                    interpolate_text(
                        '{title} ({count})', {title: expectedTitle, count: expectedCount}
                    )
                );
                expect(header.find('.title-value').text()).toBe(expectedTitle);
                expect(header.find('.group-count').text()).toBe(
                    interpolate_ntext(
                        '(contains {count} student)',
                        '(contains {count} students)',
                        expectedCount,
                        {count: expectedCount}
                    )
                );
            };

            unknownUserMessage = function (name) {
                return "Unknown user: " +  name;
            };

            beforeEach(function () {
                setFixtures('<ul class="instructor-nav"><li class="nav-item"><<a href data-section="membership" class="active-section">Membership</a></li></ul><div></div>');
                TemplateHelpers.installTemplate('templates/instructor/instructor_dashboard_2/cohorts');
                TemplateHelpers.installTemplate('templates/instructor/instructor_dashboard_2/cohort-form');
                TemplateHelpers.installTemplate('templates/instructor/instructor_dashboard_2/cohort-selector');
                TemplateHelpers.installTemplate('templates/instructor/instructor_dashboard_2/cohort-editor');
                TemplateHelpers.installTemplate('templates/instructor/instructor_dashboard_2/notification');
                TemplateHelpers.installTemplate('templates/file-upload');
            });

            it("Show an error if no cohorts are defined", function() {
                createCohortsView(this, {cohorts: []});
                verifyMessage(
                    'You currently have no cohort groups configured',
                    'warning',
                    'Add Cohort Group'
                );

                // If no cohorts have been created, can't upload a CSV file.
                expect(cohortsView.$('.wrapper-cohort-supplemental')).toHaveClass('is-hidden');
            });

            it("Syncs data when membership tab is clicked", function() {
                createCohortsView(this, {selectCohort: 1});
                verifyHeader(1, 'Cat Lovers', catLoversInitialCount);
                $(cohortsView.getSectionCss("membership")).click();
                AjaxHelpers.expectRequest(requests, 'GET', '/mock_service/cohorts');
                respondToRefresh(1001, 2);
                verifyHeader(1, 'Cat Lovers', 1001);
            });

            it('can upload a CSV of cohort assignments if a cohort exists', function () {
                var uploadCsvToggle, fileUploadForm, fileUploadFormCss='#file-upload-form';

                createCohortsView(this);

                // Should see the control to toggle CSV file upload.
                expect(cohortsView.$('.wrapper-cohort-supplemental')).not.toHaveClass('is-hidden');
                // But upload form should not be visible until toggle is clicked.
                expect(cohortsView.$(fileUploadFormCss).length).toBe(0);
                uploadCsvToggle = cohortsView.$('.toggle-cohort-management-secondary');
                expect(uploadCsvToggle.text()).
                    toContain('Assign students to cohort groups by uploading a CSV file');
                uploadCsvToggle.click();
                // After toggle is clicked, it should be hidden.
                expect(uploadCsvToggle).toHaveClass('is-hidden');

                fileUploadForm = cohortsView.$(fileUploadFormCss);
                expect(fileUploadForm.length).toBe(1);
                cohortsView.$(fileUploadForm).fileupload('add', {files: [{name: 'upload_file.txt'}]});
                cohortsView.$('.submit-file-button').click();

                // No file will actually be uploaded because "uploaded_file.txt" doesn't actually exist.
                AjaxHelpers.expectRequest(requests, 'POST', "http://upload-csv-file-url/", new FormData());
                AjaxHelpers.respondWithJson(requests, {});
                expect(cohortsView.$('.file-upload-form-result .message-confirmation .message-title').text().trim())
                    .toBe("Your file 'upload_file.txt' has been uploaded. Please allow a few minutes for processing.");
            });

            describe("Cohort Selector", function () {
                it('has no initial selection', function () {
                    createCohortsView(this);
                    expect(cohortsView.$('.cohort-select').val()).toBe('');
                    expect(cohortsView.$('.cohort-management-group-header .title-value').text()).toBe('');
                });

                it('can select a cohort', function () {
                    createCohortsView(this, {selectCohort: 1});
                    verifyHeader(1, 'Cat Lovers', catLoversInitialCount);
                });

                it('can switch cohort', function () {
                    createCohortsView(this, {selectCohort: 1});
                    cohortsView.$('.cohort-select').val("2").change();
                    verifyHeader(2, 'Dog Lovers', dogLoversInitialCount);
                });
            });

            describe("Cohort Editor Tab Panel", function () {
                it("initially selects the Manage Students tab", function () {
                    createCohortsView(this, {selectCohort: 1});
                    expect(cohortsView.$('.tab-manage_students')).toHaveClass('is-selected');
                    expect(cohortsView.$('.tab-settings')).not.toHaveClass('is-selected');
                    expect(cohortsView.$('.tab-content-manage_students')).not.toHaveClass('is-hidden');
                    expect(cohortsView.$('.tab-content-settings')).toHaveClass('is-hidden');
                });

                it("can select the Settings tab", function () {
                    createCohortsView(this, {selectCohort: 1});
                    cohortsView.$('.tab-settings a').click();
                    expect(cohortsView.$('.tab-manage_students')).not.toHaveClass('is-selected');
                    expect(cohortsView.$('.tab-settings')).toHaveClass('is-selected');
                    expect(cohortsView.$('.tab-content-manage_students')).toHaveClass('is-hidden');
                    expect(cohortsView.$('.tab-content-settings')).not.toHaveClass('is-hidden');
                });
            });

            describe("Add Cohorts Form", function () {
                var defaultCohortName = 'New Cohort';

                it("can add a cohort", function() {
                    createCohortsView(this, {cohorts: []});
                    cohortsView.$('.action-create').click();
                    expect(cohortsView.$('.cohort-management-create-form').length).toBe(1);
                    expect(cohortsView.$('.cohort-management-nav')).toHaveClass('is-disabled');
                    expect(cohortsView.$('.cohort-management-group')).toHaveClass('is-hidden');
                    cohortsView.$('.cohort-name').val(defaultCohortName);
                    cohortsView.$('.action-save').click();
                    expectCohortAddRequest(defaultCohortName);
                    AjaxHelpers.respondWithJson(
                        requests,
                        {
                            id: 1,
                            name: defaultCohortName
                        }
                    );
                    AjaxHelpers.respondWithJson(
                        requests,
                        { cohorts: createMockCohort(defaultCohortName) }
                    );
                    verifyMessage(
                        'The ' + defaultCohortName + ' cohort group has been created.' +
                            ' You can manually add students to this group below.',
                        'confirmation'
                    );
                    verifyHeader(1, defaultCohortName, 0);
                    expect(cohortsView.$('.cohort-management-nav')).not.toHaveClass('is-disabled');
                    expect(cohortsView.$('.cohort-management-group')).not.toHaveClass('is-hidden');
                    expect(getAddModal().find('.cohort-management-create-form').length).toBe(0);
                });

                it("trims off whitespace before adding a cohort", function() {
                    createCohortsView(this);
                    cohortsView.$('.action-create').click();
                    cohortsView.$('.cohort-name').val('  New Cohort   ');
                    cohortsView.$('.action-save').click();
                    expectCohortAddRequest('New Cohort');
                });

                it("does not allow a blank cohort name to be submitted", function() {
                    createCohortsView(this, {selectCohort: 1});
                    cohortsView.$('.action-create').click();
                    expect(getAddModal().find('.cohort-management-create-form').length).toBe(1);
                    cohortsView.$('.cohort-name').val('');
                    expect(cohortsView.$('.cohort-management-nav')).toHaveClass('is-disabled');
                    getAddModal().find('.action-save').click();
                    expect(requests.length).toBe(0);
                    verifyMessage('Please enter a name for your new cohort group.', 'error');
                });

                it("shows a message when adding a cohort returns a server error", function() {
                    var addModal;
                    createCohortsView(this, {selectCohort: 1});
                    cohortsView.$('.action-create').click();
                    addModal = getAddModal();
                    expect(addModal.find('.cohort-management-create-form').length).toBe(1);
                    addModal.find('.cohort-name').val(defaultCohortName);
                    addModal.find('.action-save').click();
                    AjaxHelpers.respondWithError(requests, 400, {
                        error: 'You cannot add two cohorts with the same name'
                    });
                    verifyHeader(1, 'Cat Lovers', catLoversInitialCount);
                    verifyMessage(
                        'You cannot add two cohorts with the same name',
                        'error'
                    );
                });

                it("is removed when 'Cancel' is clicked", function() {
                    createCohortsView(this, {selectCohort: 1});
                    cohortsView.$('.action-create').click();
                    expect(getAddModal().find('.cohort-management-create-form').length).toBe(1);
                    expect(cohortsView.$('.cohort-management-nav')).toHaveClass('is-disabled');
                    cohortsView.$('.action-cancel').click();
                    expect(getAddModal().find('.cohort-management-create-form').length).toBe(0);
                    expect(cohortsView.$('.cohort-management-nav')).not.toHaveClass('is-disabled');
                });

                it("shows an error if canceled when no cohorts are defined", function() {
                    createCohortsView(this, {cohorts: []});
                    cohortsView.$('.action-create').click();
                    expect(getAddModal().find('.cohort-management-create-form').length).toBe(1);
                    expect(cohortsView.$('.cohort-management-nav')).toHaveClass('is-disabled');
                    cohortsView.$('.action-cancel').click();
                    verifyMessage(
                        'You currently have no cohort groups configured',
                        'warning',
                        'Add Cohort Group'
                    );
                });

                it("hides any error message when switching to show a cohort", function() {
                    createCohortsView(this, {selectCohort: 1});

                    // First try to save a blank name to create a message
                    cohortsView.$('.action-create').click();
                    cohortsView.$('.cohort-name').val('');
                    cohortsView.$('.action-save').click();
                    verifyMessage('Please enter a name for your new cohort group.', 'error');

                    // Now switch to a different cohort
                    cohortsView.$('.cohort-select').val("2").change();
                    verifyHeader(2, 'Dog Lovers', dogLoversInitialCount);
                    verifyNoMessage();
                });

                it("hides any error message when canceling the form", function() {
                    createCohortsView(this, {selectCohort: 1});

                    // First try to save a blank name to create a message
                    cohortsView.$('.action-create').click();
                    cohortsView.$('.cohort-name').val('');
                    cohortsView.$('.action-save').click();
                    verifyMessage('Please enter a name for your new cohort group.', 'error');

                    // Now cancel the form
                    cohortsView.$('.action-cancel').click();
                    verifyNoMessage();
                });
            });

            describe("Add Students Button", function () {
                var getStudentInput, addStudents, respondToAdd;

                getStudentInput = function() {
                    return cohortsView.$('.cohort-management-group-add-students');
                };

                addStudents = function(students) {
                    getStudentInput().val(students);
                    cohortsView.$('.cohort-management-group-add-form').submit();
                };

                respondToAdd = function(result) {
                    AjaxHelpers.respondWithJson(
                        requests,
                        _.extend({ unknown: [], added: [], present: [], changed: [], success: true }, result)
                    );
                };

                it('shows an error when adding with no students specified', function() {
                    createCohortsView(this, {selectCohort: 1});
                    addStudents('    ');
                    expect(requests.length).toBe(0);
                    verifyMessage('Please enter a username or email.', 'error');
                    expect(getStudentInput().val()).toBe('');
                });

                it('can add a single student', function() {
                    var catLoversUpdatedCount = catLoversInitialCount + 1;
                    createCohortsView(this, {selectCohort: 1});
                    addStudents('student@sample.com');
                    respondToAdd({ added: ['student@sample.com'] });
                    respondToRefresh(catLoversUpdatedCount, dogLoversInitialCount);
                    verifyHeader(1, 'Cat Lovers', catLoversUpdatedCount);
                    verifyMessage('1 student has been added to this cohort group', 'confirmation');
                    expect(getStudentInput().val()).toBe('');
                });

                it('shows an error when adding a student that does not exist', function() {
                    createCohortsView(this, {selectCohort: 1});
                    addStudents('unknown@sample.com');
                    AjaxHelpers.expectRequest(
                        requests, 'POST', '/mock_service/cohorts/1/add', 'users=unknown%40sample.com'
                    );
                    respondToAdd({ unknown: ['unknown@sample.com'] });
                    respondToRefresh(catLoversInitialCount, dogLoversInitialCount);
                    verifyHeader(1, 'Cat Lovers', catLoversInitialCount);
                    verifyDetailedMessage('There was an error when trying to add students:', 'error',
                        [unknownUserMessage('unknown@sample.com')]
                    );
                    expect(getStudentInput().val()).toBe('unknown@sample.com');
                });

                it('shows a "view all" button when more than 5 students do not exist', function() {
                    var sixUsers = 'unknown1@sample.com, unknown2@sample.com, unknown3@sample.com, unknown4@sample.com, unknown5@sample.com, unknown6@sample.com';
                    createCohortsView(this, {selectCohort: 1});

                    addStudents(sixUsers);
                    AjaxHelpers.expectRequest(
                        requests, 'POST', '/mock_service/cohorts/1/add',
                        'users=' + sixUsers.replace(/@/g, "%40").replace(/, /g, "%2C+")
                    );
                    respondToAdd({ unknown: [
                        'unknown1@sample.com',
                        'unknown2@sample.com',
                        'unknown3@sample.com',
                        'unknown4@sample.com',
                        'unknown5@sample.com',
                        'unknown6@sample.com']
                    });
                    respondToRefresh(catLoversInitialCount + 6, dogLoversInitialCount);
                    verifyDetailedMessage('There were 6 errors when trying to add students:', 'error',
                        [
                            unknownUserMessage('unknown1@sample.com'), unknownUserMessage('unknown2@sample.com'),
                            unknownUserMessage('unknown3@sample.com'), unknownUserMessage('unknown4@sample.com'),
                            unknownUserMessage('unknown5@sample.com')
                        ],
                        'View all errors'
                    );
                    expect(getStudentInput().val()).toBe(sixUsers);
                    // Click "View all"
                    cohortsView.$('.action-expand').click();
                    verifyDetailedMessage('There were 6 errors when trying to add students:', 'error',
                        [
                            unknownUserMessage('unknown1@sample.com'), unknownUserMessage('unknown2@sample.com'),
                            unknownUserMessage('unknown3@sample.com'), unknownUserMessage('unknown4@sample.com'),
                            unknownUserMessage('unknown5@sample.com'), unknownUserMessage('unknown6@sample.com')
                        ]
                    );
                });

                it('shows students moved from one cohort to another', function() {
                    var sixUsers = 'moved1@sample.com, moved2@sample.com, moved3@sample.com, alreadypresent@sample.com';
                    createCohortsView(this, {selectCohort: 1});

                    addStudents(sixUsers);
                    AjaxHelpers.expectRequest(requests, 'POST', '/mock_service/cohorts/1/add',
                            'users=' + sixUsers.replace(/@/g, "%40").replace(/, /g, "%2C+")
                    );
                    respondToAdd({
                        changed: [
                            {email: 'moved1@sample.com', name: 'moved1', previous_cohort: 'group 2', username: 'moved1'},
                            {email: 'moved2@sample.com', name: 'moved2', previous_cohort: 'group 2', username: 'moved2'},
                            {email: 'moved3@sample.com', name: 'moved3', previous_cohort: 'group 3', username: 'moved3'}
                        ],
                        present: ['alreadypresent@sample.com']
                    });
                    respondToRefresh();

                    verifyDetailedMessage('3 students have been added to this cohort group', 'confirmation',
                        [
                            "2 students were removed from group 2",
                            "1 student was removed from group 3",
                            "1 student was already in the cohort group"
                        ]
                    );
                    expect(getStudentInput().val()).toBe('');
                });

                it('shows a message when the add fails', function() {
                    createCohortsView(this, {selectCohort: 1});
                    addStudents('student@sample.com');
                    AjaxHelpers.respondWithError(requests);
                    verifyMessage('Error adding students.', 'error');
                    expect(getStudentInput().val()).toBe('student@sample.com');
                });

                it('clears an error message on subsequent add', function() {
                    createCohortsView(this, {selectCohort: 1});

                    // First verify that an error is shown
                    addStudents('student@sample.com');
                    AjaxHelpers.respondWithError(requests);
                    verifyMessage('Error adding students.', 'error');

                    // Now verify that the error is removed on a subsequent add
                    addStudents('student@sample.com');
                    respondToAdd({ added: ['student@sample.com'] });
                    respondToRefresh(catLoversInitialCount + 1, dogLoversInitialCount);
                    verifyMessage('1 student has been added to this cohort group', 'confirmation');
                });
            });

            describe("Cohort Settings", function () {
                it("shows an error message when no content groups are specified", function() {
                    createCohortsView(this, {selectCohort: 1, contentGroups: []});
                    cohortsView.$('.tab-settings a').click();
                    expect(
                        cohortsView.$('.msg-inline').text().trim(),
                        'You haven\'t configured any content groups yet. You need to create a content group ' +
                        'before you can create assignments.'
                    );
                });
            });
        });
    });
