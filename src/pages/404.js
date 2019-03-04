import React from 'react';
import Layout from '../components/Layout';

class NotFoundPage extends React.Component {
  render() {
    return (
      <Layout location={this.props.location}>
        <main>
          <h1>Not Found</h1>
          <p>Nothing here for the moment!</p>
        </main>
      </Layout>
    );
  }
}

export default NotFoundPage;
