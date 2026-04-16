import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Button,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'SOUPY'
const ADMIN_INBOX_URL = 'https://soupyaudit.com/app/inbox'

interface InboxNotificationProps {
  senderName?: string
  senderEmail?: string
  subject?: string
  body?: string
  sentAt?: string
}

const InboxNotificationEmail = ({
  senderName,
  senderEmail,
  subject,
  body,
  sentAt,
}: InboxNotificationProps) => {
  const who = senderName || senderEmail || 'A user'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>New {SITE_NAME} inbox message from {who}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>New message in your {SITE_NAME} inbox</Heading>
          <Text style={meta}>
            <strong>From:</strong> {who}
            {senderEmail && senderName ? ` <${senderEmail}>` : ''}
          </Text>
          {sentAt && (
            <Text style={meta}>
              <strong>Sent:</strong> {sentAt}
            </Text>
          )}
          <Hr style={hr} />
          <Text style={subjectStyle}>{subject || '(no subject)'}</Text>
          <Section style={bodyBox}>
            <Text style={bodyText}>{body || '(empty message)'}</Text>
          </Section>
          <Section style={{ textAlign: 'center', margin: '32px 0 8px' }}>
            <Button style={button} href={ADMIN_INBOX_URL}>
              Open inbox &amp; reply
            </Button>
          </Section>
          <Text style={footer}>
            Replies sent from inside {SITE_NAME} will be emailed to the user
            automatically.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: InboxNotificationEmail,
  subject: (data: Record<string, any>) =>
    `New SOUPY inbox message: ${data?.subject || '(no subject)'}`,
  displayName: 'Inbox notification (admin)',
  to: 'j.beene89@gmail.com',
  previewData: {
    senderName: 'Jackie Example',
    senderEmail: 'jackie@example.com',
    subject: 'Quick question about the audit',
    body: 'Hi — wanted to ask about the new pre-appeal flow. Thanks!',
    sentAt: new Date().toLocaleString(),
  },
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
}
const h1: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: 700,
  color: '#0f172a',
  margin: '0 0 20px',
}
const meta: React.CSSProperties = {
  fontSize: '13px',
  color: '#475569',
  margin: '0 0 6px',
}
const hr: React.CSSProperties = {
  borderColor: '#e2e8f0',
  margin: '20px 0',
}
const subjectStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#0f172a',
  margin: '0 0 12px',
}
const bodyBox: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px 18px',
}
const bodyText: React.CSSProperties = {
  fontSize: '14px',
  color: '#1e293b',
  lineHeight: '1.55',
  margin: 0,
  whiteSpace: 'pre-wrap',
}
const button: React.CSSProperties = {
  backgroundColor: '#0f172a',
  color: '#ffffff',
  padding: '12px 22px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '14px',
  display: 'inline-block',
}
const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#94a3b8',
  textAlign: 'center',
  margin: '24px 0 0',
}
