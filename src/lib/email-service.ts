/**
 * Service to handle sending admin email notifications asynchronously.
 */

export interface JoinRequestEmailData {
  name: string;
  phone: string;
  subject?: string;
  roleTitle?: string;
  subType?: string;
  subPrice?: number;
  salaryPaymentMethod?: string;
  username?: string;
  promoCode?: string | null;
}

export async function sendJoinRequestEmailNotification(
  type: 'teacher' | 'assistant',
  data: JoinRequestEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const action = type === 'teacher' ? 'teacher_request' : 'assistant_request';
    const res = await fetch('/api/admin/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        data,
      }),
    });

    const result = await res.json();
    return result;
  } catch (err: any) {
    console.error('Failed to send join request email notification:', err);
    return { success: false, error: err.message };
  }
}

export async function sendTestEmailNotification(customConfig?: any, targetEmail?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test_email',
        data: { targetEmail },
        customConfig,
      }),
    });

    const result = await res.json();
    return result;
  } catch (err: any) {
    console.error('Failed to send test email notification:', err);
    return { success: false, error: err.message };
  }
}

export interface TeacherMessageEmailData {
  teacherName: string;
  teacherPhone?: string;
  subjectName?: string;
  messageContent: string;
  messageType?: string;
  fileUrl?: string;
}

export async function sendTeacherMessageEmailNotification(
  data: TeacherMessageEmailData
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/admin/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'teacher_message',
        data,
      }),
    });

    const result = await res.json();
    return result;
  } catch (err: any) {
    console.error('Failed to send teacher message email notification:', err);
    return { success: false, error: err.message };
  }
}
