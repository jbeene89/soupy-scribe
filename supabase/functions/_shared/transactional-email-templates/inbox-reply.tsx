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
const INBOX_URL = 'https://soupyaudit.com/app/inbox'

interface ReplyProps {
  recipientName?: string
  originalSubject?: string
  originalBody?: string
  replyBody?: string
  repliedAt?: string
}

const InboxReplyEmail = ({
  recipientName,
  originalSubject,
  originalBody,
  replyBody,
  repliedAt,
}: ReplyProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>The {SITE_NAME} team replied to your message</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {recipientName ? `Hi ${recipientName},` : 'Hi,'}
        </Heading>
        <Text style={lede}>
          The {SITE_NAME} team replied to your message
          {originalSubject ? ` "${originalSubject}"` : ''}.
        </Text>

        <Section style={replyBox}>
          <Text style={replyText}>{replyBody || '(empty reply)'}</Text>
        </Section>

        {repliedAt && <Text style={meta}>Sent {repliedAt}</Text>}

        <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
          <Button style={button} href={INBOX_URL}>
            View &amp; reply in {SITE_NAME}
          </Button>
        </Section>

        {originalBody && (
          <>
            <Hr style={hr} />
            <Text style={origLabel}>Your original message:</Text>
            <Section style={origBox}>
              <Text style={origText}>{originalBody}</Text>
            </Section>
          </>
        )}

        <Text style={footer}>
          You're receiving this because you sent a message to the {SITE_NAME}{' '}
          team. Reply inside {SITE_NAME} to continue the conversation.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InboxReplyEmail,
  subject: (data: Record<string, any>) =>
    `Re: ${data?.originalSubject || 'your SOUPY message'}`,
  displayName: 'Inbox reply (to user)',
  previewData: {
    recipientName: 'Jackie',
    originalSubject: 'Quick question about the audit',
    originalBody: 'Hi — wanted to ask about the new pre-appeal flow.',
    replyBody: 'Thanks for reaching out! Here\'s how that flow works…',
    repliedAt: new Date().toLocaleString(),
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
  fontSize: '20px',
  fontWeight: 700,
  color: '#0f172a',
  margin: '0 0 12px',
}
const lede: React.CSSProperties = {
  fontSize: '14px',
  color: '#334155',
  margin: '0 0 18px',
}
const replyBox: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  padding: '16px 18px',
}
const replyText: React.CSSProperties = {
  fontSize: '14px',
  color: '#0f172a',
  lineHeight: '1.6',
  margin: 0,
  whiteSpace: 'pre-wrap',
}
const meta: React.CSSProperties = {
  fontSize: '11px',
  color: '#94a3b8',
  margin: '8px 0 0',
}
const hr: React.CSSProperties = {
  borderColor: '#e2e8f0',
  margin: '28px 0 16px',
}
const origLabel: React.CSSProperties = {
  fontSize: '12px',
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 600,
  margin: '0 0 8px',
}
const origBox: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '12px 14px',
}
const origText: React.CSSProperties = {
  fontSize: '13px',
  color: '#475569',
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
