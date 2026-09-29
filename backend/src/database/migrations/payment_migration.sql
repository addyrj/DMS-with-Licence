-- Run on master_db
CREATE TABLE IF NOT EXISTS payment_history (
  id              BIGINT PRIMARY KEY AUTO_INCREMENT,
  client_id       BIGINT NOT NULL,
  razorpay_order_id   VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  payment_type    ENUM('display','storage','subscription') NOT NULL,
  quantity        INT DEFAULT 1,
  amount_paise    INT NOT NULL,
  status          ENUM('created','paid','failed') DEFAULT 'created',
  meta            JSON DEFAULT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_client (client_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
