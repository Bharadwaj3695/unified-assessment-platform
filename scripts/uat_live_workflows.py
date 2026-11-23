#!/usr/bin/env python3
"""
UAP Unified Test API Practical User Acceptance Testing (UAT)
Validates end-to-end Faculty -> Student -> Evaluation workflows on live Docker stack.
"""

import urllib.request
import urllib.error
import json
import sys
import time

BASE_URL = 'http://127.0.0.1:5000'

def request(method, path, data=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f"Bearer {token}"
    body = json.dumps(data).encode('utf-8') if data is not None else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            resp_body = resp.read().decode('utf-8')
            return resp.status, json.loads(resp_body) if resp_body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            parsed = json.loads(err_body)
        except Exception:
            parsed = {'raw': err_body}
        return e.code, parsed

def run_uat():
    results = []
    print("=" * 70)
    print("STARTING UAP UNIFIED TEST API END-TO-END UAT ON DOCKER DEV STACK")
    print("=" * 70)

    # -------------------------------------------------------------
    # 0. Initial Health & Authentication
    # -------------------------------------------------------------
    status, body = request('GET', '/api/health')
    assert status == 200, f"Health check failed: {status}"
    print(f"[PASS] Health check: {status} ({body.get('status')})")

    # Faculty login
    status, body = request('POST', '/api/auth/login', {'email': 'ins01@uap.edu', 'password': 'Instructor@123'})
    assert status == 200, f"Instructor login failed: {status} {body}"
    instructor_token = body['data']['accessToken']
    instructor_id = body['data']['user']['id']
    print(f"[PASS] Faculty Login: HTTP {status} (ins01@uap.edu)")

    # Student login
    status, body = request('POST', '/api/auth/login', {'email': 'std01@uap.edu', 'password': 'Student@123'})
    assert status == 200, f"Student login failed: {status} {body}"
    student_token = body['data']['accessToken']
    student_id = body['data']['user']['id']
    print(f"[PASS] Student Login: HTTP {status} (std01@uap.edu)")

    # -------------------------------------------------------------
    # WORKFLOW 1: Assessment Lifecycle (Faculty -> Student -> Evaluation)
    # -------------------------------------------------------------
    print("\n" + "-" * 50)
    print("WORKFLOW 1: Assessment Lifecycle via Unified /api/tests/assessments")
    print("-" * 50)

    # 1.1 Faculty creates and publishes an Assessment
    unique_ts = int(time.time())
    asmt_payload = {
        "title": f"UAT Assessment Workflow {unique_ts}",
        "description": "Live practical UAT testing unified test API",
        "category": "Computer Science",
        "durationMinutes": 60,
        "passingScore": 50,
        "status": "published",
        "accessType": "public",
        "questions": [
            {
                "questionText": "Is JavaScript single-threaded in its main execution thread?",
                "type": "mcq",
                "options": [
                    {"id": "opt_a", "text": "Yes, it uses a single call stack and event loop"},
                    {"id": "opt_b", "text": "No, it spawns 10 OS threads by default"}
                ],
                "correctAnswer": "opt_a",
                "explanation": "JavaScript main thread runs a single event loop.",
                "points": 10
            },
            {
                "questionText": "Explain the role of Node.js Event Loop in asynchronous non-blocking I/O.",
                "type": "short_answer",
                "points": 10
            }
        ]
    }
    status, body = request('POST', '/api/tests/assessments', asmt_payload, instructor_token)
    assert status == 201, f"Assessment creation failed: {status} {body}"
    assessment_id = body['data']['_id']
    print(f"[PASS] 1.1 Faculty authored and published Assessment: ID {assessment_id}")

    # 1.2 Student fetches catalog and views assessment
    status, body = request('GET', f'/api/tests/assessments/{assessment_id}', None, student_token)
    assert status == 200, f"Student fetch assessment failed: {status}"
    questions = body['data'].get('questions', [])
    assert len(questions) == 2, f"Expected 2 questions, got {len(questions)}"
    q1_id = questions[0]['_id']
    q2_id = questions[1]['_id']
    # Verify answers are hidden from student
    assert 'correctAnswer' not in questions[0]
    print(f"[PASS] 1.2 Student retrieved Assessment catalog details (correctAnswer protected)")

    # 1.3 Student starts attempt via unified route POST /api/tests/assessments/:id/attempts
    status, body = request('POST', f'/api/tests/assessments/{assessment_id}/attempts', None, student_token)
    assert status in [200, 201], f"Student start attempt failed: {status} {body}"
    submission_id = body['data']['_id']
    print(f"[PASS] 1.3 Student initialized attempt: Submission ID {submission_id}")

    # 1.4 Student autosaves answer for Q1 (MCQ)
    status, body = request(
        'PATCH',
        f'/api/tests/assessments/attempts/{submission_id}/answers/{q1_id}',
        {"answer": "opt_a", "timeSpentSeconds": 15},
        student_token
    )
    assert status == 200, f"Autosave answer failed: {status} {body}"
    print(f"[PASS] 1.4 Student autosaved Q1 answer via unified patch endpoint")

    # 1.5 Student saves progress for Q2
    status, body = request(
        'PUT',
        f'/api/tests/assessments/attempts/{submission_id}/progress',
        {"answers": [{"questionId": q2_id, "answer": "The event loop offloads async operations and polls for completion."}]},
        student_token
    )
    assert status == 200, f"Save progress failed: {status} {body}"
    print(f"[PASS] 1.5 Student saved progress via unified put endpoint")

    # 1.6 Student submits assessment
    status, body = request(
        'POST',
        f'/api/tests/assessments/attempts/{submission_id}/submit',
        None,
        student_token
    )
    assert status == 200, f"Submit assessment failed: {status} {body}"
    print(f"[PASS] 1.6 Student submitted assessment via unified submit endpoint")

    # 1.7 Faculty views evaluation queue
    status, body = request('GET', '/api/tests/assessments/evaluations', None, instructor_token)
    assert status == 200, f"Fetch evaluation queue failed: {status}"
    submissions = body.get('data') if isinstance(body.get('data'), list) else body.get('data', {}).get('submissions', [])
    target_sub = next((s for s in submissions if str(s.get('_id')) == submission_id), None)
    assert target_sub is not None, f"Submission {submission_id} not found in evaluation queue"
    print(f"[PASS] 1.7 Faculty retrieved evaluation queue via GET /api/tests/assessments/evaluations")

    # 1.8 Faculty evaluates the subjective question
    eval_payload = {
        "score": 10,
        "feedback": "Comprehensive and clear explanation of the event loop.",
        "questionScores": [
            {
                "questionId": q2_id,
                "score": 10,
                "feedback": "Accurate response."
            }
        ]
    }
    status, body = request(
        'POST',
        f'/api/tests/assessments/attempts/{submission_id}/evaluate',
        eval_payload,
        instructor_token
    )
    assert status == 200, f"Manual evaluation failed: {status} {body}"
    print(f"[PASS] 1.8 Faculty manually graded submission via unified evaluate endpoint")

    # 1.9 Student checks result and score
    status, body = request('GET', f'/api/tests/assessments/attempts/{submission_id}', None, student_token)
    assert status == 200, f"Student get result failed: {status}"
    result_data = body.get('data', {})
    assert result_data.get('status') in ['evaluated', 'graded', 'submitted'], f"Unexpected status {result_data.get('status')}"
    print(f"[PASS] 1.9 Student result visibility verified: Score {result_data.get('totalScore', result_data.get('score'))}/20")

    # -------------------------------------------------------------
    # WORKFLOW 2: Mock Test Lifecycle (Faculty -> Student -> Review)
    # -------------------------------------------------------------
    print("\n" + "-" * 50)
    print("WORKFLOW 2: Mock Test Lifecycle via Unified /api/tests/mock-tests")
    print("-" * 50)

    # 2.1 Fetch or create subject via Question Bank API
    status, body = request('GET', '/api/subjects', None, instructor_token)
    assert status == 200, f"Fetch subjects failed: {status}"
    subjects = body.get('data', [])
    if not subjects:
        create_subj_status, create_subj_body = request(
            'POST',
            '/api/subjects',
            {"name": "Computer Science", "code": "CS"},
            instructor_token
        )
        assert create_subj_status == 201, f"Create subject failed: {create_subj_status} {create_subj_body}"
        subject_id = create_subj_body['data']['_id']
        print(f"[PASS] 2.1 Faculty created Subject in Question Bank: Computer Science (ID: {subject_id})")
    else:
        subject_id = subjects[0]['_id']
        print(f"[PASS] 2.1 Faculty selected existing Subject: {subjects[0].get('name')} (ID: {subject_id})")

    # 2.1b Ensure published Question Bank item exists for blueprint selection (Descriptive question for manual evaluation)
    qb_q_payload = {
        "subjectId": subject_id,
        "statement": "Explain the concept of Big-O asymptotic notation in computer science.",
        "questionType": "DESCRIPTIVE",
        "marks": 10
    }
    status, body = request('POST', '/api/questions', qb_q_payload, instructor_token)
    assert status == 201, f"Create bank question failed: {status} {body}"
    bank_q_id = body['data']['_id']
    status, _ = request('POST', f'/api/questions/{bank_q_id}/publish', None, instructor_token)
    assert status == 200, f"Publish bank question failed: {status}"
    print(f"[PASS] 2.1b Faculty authored & published Question Bank item: ID {bank_q_id}")

    # 2.2 Create Mock Test
    mock_payload = {
        "title": f"UAT Live Mock Test {unique_ts}",
        "description": "Practical UAT mock test",
        "subjectId": subject_id,
        "durationMinutes": 45,
        "totalMarks": 10,
        "selectionMode": "BLUEPRINT",
        "blueprint": {
            "rules": [
                {"count": 1, "marksPerQuestion": 10, "difficulty": "ANY", "questionType": "DESCRIPTIVE"}
            ]
        }
    }
    status, body = request('POST', '/api/tests/mock-tests', mock_payload, instructor_token)
    assert status == 201, f"Create mock test failed: {status} {body}"
    mock_test_id = body['data']['_id']
    print(f"[PASS] 2.2 Faculty created Mock Test: ID {mock_test_id}")

    # 2.3 Generate blueprint questions
    status, body = request('POST', f'/api/tests/mock-tests/{mock_test_id}/generate', None, instructor_token)
    assert status == 200, f"Blueprint generation failed: {status} {body}"
    resolved_qs = body['data'].get('resolvedQuestions', [])
    assert len(resolved_qs) >= 1, f"Expected at least 1 question, got {len(resolved_qs)}"
    mock_q_id = resolved_qs[0]['questionId']
    print(f"[PASS] 2.3 Faculty generated Mock Test Blueprint ({len(resolved_qs)} questions locked)")

    # 2.4 Publish Mock Test
    status, body = request('POST', f'/api/tests/mock-tests/{mock_test_id}/publish', None, instructor_token)
    assert status == 200, f"Publish mock test failed: {status} {body}"
    print(f"[PASS] 2.4 Faculty published Mock Test")

    # 2.5 Student lists mock tests via unified endpoint
    status, body = request('GET', '/api/tests/mock-tests', None, student_token)
    assert status == 200, f"Student list mock tests failed: {status}"
    mock_tests = body.get('data', [])
    target_mt = next((m for m in mock_tests if str(m.get('_id')) == mock_test_id), None)
    assert target_mt is not None, f"Mock test {mock_test_id} not visible in student catalog"
    print(f"[PASS] 2.5 Student found published Mock Test in GET /api/tests/mock-tests")

    # 2.6 Student starts attempt via RESTful plural alias POST /api/tests/mock-tests/:id/attempts
    status, body = request('POST', f'/api/tests/mock-tests/{mock_test_id}/attempts', None, student_token)
    assert status == 200, f"Student start mock attempt failed: {status} {body}"
    mock_attempt_id = body['data']['attemptId']
    print(f"[PASS] 2.6 Student initialized mock test attempt via plural alias: Attempt ID {mock_attempt_id}")

    # 2.7 Student submits mock test attempt via RESTful path POST /api/tests/mock-tests/attempts/:attemptId/submit
    submit_payload = {
        "responses": [
            {
                "questionId": str(mock_q_id),
                "textAnswer": "Big-O notation characterizes the mathematical upper bound of runtime complexity as input size approaches infinity.",
                "timeSpentSeconds": 45
            }
        ]
    }
    status, body = request(
        'POST',
        f'/api/tests/mock-tests/attempts/{mock_attempt_id}/submit',
        submit_payload,
        student_token
    )
    assert status == 200, f"Student submit mock attempt failed: {status} {body}"
    print(f"[PASS] 2.7 Student submitted mock test attempt via /attempts/:attemptId/submit")

    # 2.8 Student retrieves analytics
    status, body = request('GET', f'/api/tests/mock-tests/attempts/{mock_attempt_id}/analytics', None, student_token)
    assert status == 200, f"Student get mock analytics failed: {status}"
    print(f"[PASS] 2.8 Student retrieved performance analytics via unified endpoint")

    # 2.9 Faculty reviews attempts list and attempt details
    status, body = request('GET', f'/api/tests/mock-tests/{mock_test_id}/attempts', None, instructor_token)
    assert status == 200, f"Faculty get mock attempts failed: {status}"
    status, body = request('GET', f'/api/tests/mock-tests/attempts/{mock_attempt_id}/review', None, instructor_token)
    assert status == 200, f"Faculty get mock attempt review failed: {status}"
    print(f"[PASS] 2.9 Faculty retrieved candidate attempt review via unified endpoint")

    # 2.10 Faculty grades mock test attempt
    grade_payload = {
        "responsesFeedback": [
            {
                "questionId": str(mock_q_id),
                "marksAwarded": 10,
                "feedback": "Accurate description of asymptotic notation."
            }
        ],
        "generalFeedback": "Solid performance on mock test."
    }
    status, body = request(
        'POST',
        f'/api/tests/mock-tests/attempts/{mock_attempt_id}/evaluate',
        grade_payload,
        instructor_token
    )
    assert status == 200, f"Faculty evaluate mock attempt failed: {status} {body}"
    print(f"[PASS] 2.10 Faculty completed manual grading on mock test attempt (Score: 10/10)")

    print("\n" + "=" * 70)
    print("ALL UAT WORKFLOWS COMPLETED SUCCESSFULLY WITH 100% PASS RATE!")
    print("=" * 70)

if __name__ == '__main__':
    run_uat()
