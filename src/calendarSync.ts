import { Task, DailyPlan, DailyPlanItem } from './types';
import { getAccessToken, signOut } from './firebaseAuth';

const getTasksCalendarId = async (token: string): Promise<string> => {
  try {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('google_oauth_token');
        signOut();
        window.location.reload();
        throw new Error("Google Calendar session expired. Logging out.");
      }
      console.error("Failed to fetch calendar list. Status:", response.status);
      return 'primary';
    }
    const data = await response.json();
    const tasksCalendar = data.items.find((c: any) => c.summary === 'Tasks' || (c.summary && c.summary.toLowerCase() === 'tasks'));
    
    if (tasksCalendar) {
      return encodeURIComponent(tasksCalendar.id);
    } else {
      console.log("No calendar named 'Tasks' found. Creating one...");
      // Create a new calendar
      const createResponse = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ summary: 'Tasks' })
      });
      if (createResponse.ok) {
        const newCalendar = await createResponse.json();
        console.log("Created Tasks calendar:", newCalendar.id);
        return encodeURIComponent(newCalendar.id);
      } else {
        console.error("Failed to create Tasks calendar. Falling back to primary.", createResponse.status, await createResponse.text());
        if (createResponse.status === 401 || createResponse.status === 403) {
          localStorage.removeItem('google_oauth_token');
          signOut();
          window.location.reload();
          throw new Error("Insufficient Google Calendar permissions or session expired. Logging out to request full access.");
        }
      }
    }
  } catch (e: any) {
    if (e.message?.includes("session expired")) {
      throw e;
    }
    console.error("Error finding Tasks calendar", e);
  }
  return 'primary';
};

export const syncTaskToCalendar = async (task: Task) => {
  const token = await getAccessToken();
  if (!token) {
    console.warn("Not connected to Google Calendar. Task not synced automatically. Please sign in.");
    return false;
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Convert deadline to start/end dates with time and duration
  const parts = task.deadline.split('-');
  const year = parts[0] ? parseInt(parts[0], 10) : new Date().getFullYear();
  const month = parts[1] ? parseInt(parts[1], 10) - 1 : new Date().getMonth();
  const day = parts[2] ? parseInt(parts[2], 10) : new Date().getDate();

  let endHour = 17;
  let endMinute = 0;
  if (task.time) {
    const timeParts = task.time.split(':');
    if (timeParts[0]) endHour = parseInt(timeParts[0], 10);
    if (timeParts[1]) endMinute = parseInt(timeParts[1], 10);
  }

  const effortHours = task.effort || 1;

  // The deadline is the end time
  const endDt = new Date(year, month, day, endHour, endMinute, 0);
  
  // Start time is deadline minus effort
  const startDt = new Date(endDt.getTime() - effortHours * 60 * 60 * 1000);

  const remindersObj: any = { useDefault: true };
  if (task.reminder && task.reminder !== "none") {
    let minutes = 0;
    if (task.reminder === "0min") minutes = 0;
    else if (task.reminder === "15min") minutes = 15;
    else if (task.reminder === "30min") minutes = 30;
    else if (task.reminder === "1hour") minutes = 60;
    else if (task.reminder === "1day") minutes = 1440;

    remindersObj.useDefault = false;
    remindersObj.overrides = [
      { method: 'popup', minutes },
    ];
  }

  const event = {
    summary: `Task: ${task.title}`,
    description: `Effort: ${task.effort}h\nPriority: ${task.priority}\nRisk: ${task.riskScore}% - ${task.riskReason}`,
    start: {
      dateTime: startDt.toISOString(),
      timeZone,
    },
    end: {
      dateTime: endDt.toISOString(),
      timeZone,
    },
    reminders: remindersObj,
  };

  const calendarId = await getTasksCalendarId(token);

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('google_oauth_token');
      signOut();
      window.location.reload();
      throw new Error("Google Calendar session expired. Logging out.");
    }
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to sync to Google Calendar.");
  }

  return await response.json();
};

export const syncTasksToCalendarBulk = async (tasks: Task[]) => {
  let syncedCount = 0;
  for (const task of tasks) {
    if (task.statusKey !== 'completed') {
      await syncTaskToCalendar(task);
      syncedCount++;
    }
  }
  return syncedCount;
};

export const syncDailyPlanItemToCalendar = async (dateStr: string, item: DailyPlanItem) => {
  const token = await getAccessToken();
  if (!token) {
    console.warn("Not connected to Google Calendar. Item not synced automatically. Please sign in.");
    return false;
  }

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Parse targetDate (YYYY-MM-DD) and item.time (e.g. "09:00")
  const dateParts = dateStr.split('-');
  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1;
  const day = parseInt(dateParts[2], 10);

  const [hour, minute] = item.time.split(':').map(Number);
  
  const startDt = new Date(year, month, day, hour, minute || 0, 0);
  const endDt = new Date(startDt.getTime() + (item.durationMin || 60) * 60 * 1000);

  const event = {
    summary: `Plan: ${item.taskTitle}`,
    description: `Priority: ${item.priority}\nDuration: ${item.durationMin} mins`,
    start: {
      dateTime: startDt.toISOString(),
      timeZone,
    },
    end: {
      dateTime: endDt.toISOString(),
      timeZone,
    },
  };

  const calendarId = await getTasksCalendarId(token);

  const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('google_oauth_token');
      signOut();
      window.location.reload();
      throw new Error("Google Calendar session expired. Logging out.");
    }
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Failed to sync plan item to Google Calendar.");
  }

  return await response.json();
};

export const syncDailyPlanToCalendar = async (plan: DailyPlan) => {
  let syncedCount = 0;
  for (const item of plan.items) {
    await syncDailyPlanItemToCalendar(plan.date, item);
    syncedCount++;
  }
  return syncedCount;
};
